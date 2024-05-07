import os
import sys
import time

import pyreqwest_impersonate as reqwest
import capsolver

from enum import Enum


class TypedCfplatform(Enum):
    MANAGED = "cType: 'managed'"
    JAVASCRIPT = "cType: 'non-interactive'"
    INTERACTIVE = "cType: 'interactive'"
    PASS = "PASS"

    @classmethod
    def from_string(cls, value):
        for item in cls:
            if item.value in value:
                return item
        return cls.PASS


def format_proxy(proxy_str):
    # Check if the proxy_str starts with 'http://', 'https://', 'socks5h://'
    if proxy_str.startswith('http://'):
        proxy_str = proxy_str.replace('http://', 'http:')
    elif proxy_str.startswith('https://'):
        proxy_str = proxy_str.replace('https://', 'https:')
    elif proxy_str.startswith('socks5h://'):
        proxy_str = proxy_str.replace('socks5h://', 'socks5:')

    # Split the string into components
    protocol, rest = proxy_str.split(':', 1)
    user_pwd, ip_port = rest.split('@', 1)

    # Swap the positions of user_pwd and ip_port
    formatted_proxy = f"{protocol}:{ip_port}:{user_pwd}"

    return formatted_proxy


def start_challenge(key, proxyd, link: str):
    client = reqwest.Client(impersonate="chrome_123",
                            proxy=proxyd,
                            headers={"cookie": "oai-dm-tgt-c-240329=2024-04-02"}
                            )

    # get request
    resp = client.get(link)

    # challenge content
    content = resp.text

    platform = TypedCfplatform.from_string(str(content))
    print('Request url:', resp.url)
    print('Response status code:', resp.status_code)

    # if is PASS
    if platform == TypedCfplatform.PASS:
        print("Challenge passed!")
        return
    else:
        print(f"Challenge required: {platform}")

    # Use CapSolver API to solve the challenge
    try:

        proxyd = format_proxy(proxyd)
        print(f"Proxy: {proxyd}")

        solution = capsolver.solve({
            "type": "AntiCloudflareTask",
            "websiteURL": link,
            "proxy": proxyd,
            "key": key,
        })

        # print the solution
        print(f"Solution: {solution}")

    except Exception as e:
        print(f"Failed to solve the challenge: {e}")
        return


def main(key, proxyd, link: str):
    start_challenge(key, proxyd, link)


if __name__ == "__main__":

    api_key = os.getenv('CAPSOLVER_API_KEY')
    if api_key is None:
        print("Please set the CAPSOLVER_API_KEY environment variable.")
        sys.exit(1)

    proxy = os.getenv('PROXY')
    if proxy is None:
        print("Please set the PROXY environment variable.")
        sys.exit(1)

    url = os.getenv('URL')
    if url is None:
        print("Please set the URL environment variable.")
        sys.exit(1)

    start_time = time.time()
    main(api_key, proxy, url)
    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Execution time: {elapsed_time} seconds")
