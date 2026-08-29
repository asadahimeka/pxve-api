import asyncio
import argparse
import json
from pathlib import Path
from twikit import Client

parser = argparse.ArgumentParser()
group = parser.add_mutually_exclusive_group(required=True)
group.add_argument('--user', help='X screen name (e.g. elonmusk)')
group.add_argument('--userid', help='X user id (numeric)')
parser.add_argument('--limit', type=int, default=40)
parser.add_argument('--cursor')
args = parser.parse_args()

# Enter your account information
# USERNAME = '...'
# EMAIL = '...'
# PASSWORD = '...'

client = Client('en-US')

def safe_getattr(obj, attr_path, default=None):
    """
    安全获取嵌套属性，例如 safe_getattr(m, 'streams.0.url')
    """
    attrs = attr_path.split('.')
    for attr in attrs:
        if attr.isdigit():
            try:
                obj = obj[int(attr)]
            except (IndexError, TypeError, ValueError):
                return default
        else:
            obj = getattr(obj, attr, None)
            if obj is None:
                return default
    return obj

async def main():
    # Asynchronous client methods are coroutines and
    # must be called using `await`.
    # await client.login(
    #     auth_info_1=USERNAME,
    #     auth_info_2=EMAIL,
    #     password=PASSWORD
    # )

    cookies_path = Path(__file__).parent / 'cookies.json'
    client.load_cookies(cookies_path)

    # Get user by screen name
    if args.userid:
        user_id = args.userid
    else:
        user = await client.get_user_by_screen_name(args.user)
        user_id = user.id

    # Get user tweets
    user_tweets = await client.get_user_tweets(user_id, 'Media', count=args.limit, cursor=args.cursor or None)

    res = []
    for tweet in user_tweets:
        res.append({
            'id': tweet.id,
            'text': tweet.text,
            'full_text': tweet.full_text,
            'created_at': tweet.created_at,
            'favorite_count': tweet.favorite_count,
            'view_count': tweet.view_count,
            'media': [
                {
                  'id': m.id,
                  'media_url': m.media_url,
                  'type': m.type,
                  'width': m.width,
                  'height': m.height,
                  'stream_url': safe_getattr(m, 'streams.0.url'),
                }
                for m in tweet.media or []
            ],
        })

    print(json.dumps({
        'results': res,
        'next_cursor': user_tweets.next_cursor,
        'user_id': user_id,
    }))


asyncio.run(main())
