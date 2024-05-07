const { socksDispatcher } = require("fetch-socks");

class TypedCfplatform {
    static MANAGED = "cType: 'managed'";
    static JAVASCRIPT = "cType: 'non-interactive'";
    static INTERACTIVE = "cType: 'interactive'";
    static PASS = "PASS";

    static fromString(value) {
        if (value.includes("cType: 'managed'")) {
            return this.MANAGED;
        } else if (value.includes("cType: 'non-interactive'")) {
            return this.JAVASCRIPT;
        } else if (value.includes("cType: 'interactive'")) {
            return this.INTERACTIVE;
        }
        return this.PASS;
    }
}

function formatProxy(proxyStr) {
    // Check if the proxyStr starts with 'http://', 'https://', 'socks5h://'
    let url = new URL(proxyStr.replace("socks5h", "socks5"));
    let protocol = url.protocol;
    let userPwd = url.username && url.password ? `${url.username}:${url.password}` : '';

    let formattedProxy = {
        protocol: protocol,
        userPwd: userPwd,
        host: url.hostname,
        port: url.port,
    };

    // to string
    if (formattedProxy.userPwd !== '') {
        formattedProxy = `${formattedProxy.protocol}${formattedProxy.host}:${formattedProxy.port}:${formattedProxy.userPwd}`;

        return {
            str: formattedProxy,
            protocol: protocol,
            host: url.hostname,
            port: url.port,
            userId: url.username,
            password: url.password,
        }
    } else {
        formattedProxy = `${formattedProxy.protocol}${formattedProxy.host}:${formattedProxy.port}`;
    } return {
        str: formattedProxy,
        protocol: protocol,
        host: url.hostname,
        port: url.port,
    }

}

async function start_challenger(apiKey, proxyd, url) {
    let proxy = formatProxy(proxyd);

    console.log("Using proxy: ", proxy.str)

    const dispatcher = socksDispatcher({
        type: 5,
        host: proxy.host,
        port: parseInt(proxy.port, 10),
        userId: proxy.userId,
        password: proxy.password,
    });

    let resp = await fetch(url,
        { dispatcher }
    )

    let content = await resp.text();

    console.log("Request status: ", resp.status)
    let typedCfplatform = TypedCfplatform.fromString(content);
    if (typedCfplatform === TypedCfplatform.PASS) {
        console.info("Challenge passed")
        return;
    }

    console.info("Start challenge...")

    let playload = {
        "clientKey": apiKey,
        "task": {
            "type": "AntiCloudflareTask",
            "websiteURL": url,
            "proxy": proxy.str
        }

    }

    let response = await fetch("https://api.capsolver.com/createTask", {
        dispatcher,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(playload),
    })

    let taskStatus = await response.json();

    console.log("Task status: ", taskStatus)


    let taskPlayload = {
        "clientKey": apiKey,
        "taskId": taskStatus.taskId
    }

    let taskJson = null;
    while (true) {
        let taskResponse = await fetch("https://api.capsolver.com/getTaskResult", {
            dispatcher,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskPlayload),
        });

        taskJson = await taskResponse.json();

        if (taskJson.status === 'ready') {
            console.log("Task result: ", taskJson)
            break;
        }

        // Wait for a short period before the next request
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

}

const apiKey = process.env.CAPSOLVER_API_KEY;

if (!apiKey) {
    console.error('Please set the CAPSOLVER_API_KEY environment variable.');
    process.exit(1);
}

const proxy = process.env.PROXY;

if (!proxy) {
    console.error('Please set the PROXY environment variable.');
    process.exit(1);
}

const url = process.env.URL;

if (!url) {
    console.error('Please set the URL environment variable.');
    process.exit(1);
}

start_challenger(apiKey, proxy, url)