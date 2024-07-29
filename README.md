# govbot

A discord bot for collective decision making, with the goal of being both _effective_, and _aligned_.

Some principles it follows:

_aligned_

- Decisions aren't enacted without the approval and input of the community they impact.

_effective_

- Decisions pull in the expertise of the community and relevant subject-matter-experts.

It is primarily for the Mina protocol community, but is intended to eventually be possible to deploy for other communities too.

See documentation on the plan for this [here](https://docs.google.com/document/d/1aNGYqRoUVXtOw8aef9mSQHHSIvG2thnrxMw7FCB_AhM/edit).

## Instructions

1. Clone the repo
2. Run `npm install`
3. Create a `.env` file in the root directory with the following variables:

```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_client_id (A.K.A. application id)
GUILD_ID=your_guild_id (A.K.A. server id)
PUBLIC_KEY=your_apps_public_key
```

4. Run `npm run dev` to start the bot in development mode

## Checking For Required Channels

In order to check if the required channels have been created on your server, you can run the following command:

```
npm run manage checkChannels
```

## Adding Admins

In order to add an admin to the bot, you can run the following command:

```
npm run manage addAdmin [discord_user_id]
```

## Contributions

To make a contribution, follow these steps:

1. Make an issue that includes a user story for what the user should be able to do.
2. Get that issue tested by: es92, Remigiusz-antczak or Cristina Echeverry.
3. Get that issue approved by the product owners: es92, Remigiusz-antczak or Cristina Echeverry.
4. Write a PR and get it approved by the code owners and Mina devops: Es92, illya (developer), johnmarcou (Mina devops). Each PR must correspond to an approved issue. By default, PRs should be merged by the PR submitter, though in some cases if changes are needed, they can be merged by code owners.

## Docker image

### Build it

```
docker build -t <your-image-name>:<your-image-tag> .
```

### Run it

```
docker run -it -d --env-file ./.env <your-image-name>:<your-image-tag>
```

The `--env-file` flag takes a filename as an argument and expects each line to be in the VAR=VAL format, mimicking the argument passed to `--env`. Comment lines need only be prefixed with #

### Test it

```
docker-compose up --build
```
