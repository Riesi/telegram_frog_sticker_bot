# Telegram Frog Sticker Bot
This is the repository of the Telegram sticker bot that is used for the [Frogging Family Sticker Pack](https://telegram.me/addstickers/FroggingFamily_by_FroggingFamilyBot).

# Requirements
The following files and their content are required for the bot to function.

## Configuration File
Configure the content of the `.env` file in the project root next to `bot.js`.

Example content of `.env` file:
```
TG_TOKEN=<BOT_TOKEN>
REPO=<REPOSITORY_PATH>
GITREPO=https://github.com/Riesi/frog_emojis.git
GITBRANCH=master
OWNER=<BOT_OWNER>
```
## Definitions File
The repository located at `GITREPO` needs to contain a file called `telegram_definitions.txt` in its root with the following structure and the following requirements.
The bot expects all the files listed in the definitions file to be located in the `./png/512/` folder.
Each entry in the definitions file is separated by a newline.

The following entries are possible:

- Normal Mapping: Require the path to the sticker image separated by a `|` symbol and emojis to which the sticker should be mapped to.
- Direct Mapping: Require the `U*-` prefix, which consists of the letter `U` followed by the unicode code points all separated by `-`, and are not allowed to have anything else on their line.

Example content of `telegram_definitions.txt` file:

```
U1f920-frogCowboy.png
U1f44d-thumbsUp.png
U1f9d1-200d-1f3a8-frogArtist.png
other/frog2b.png|🤖
other/frogBeerCan.png|🍻🍺
other/frogBeer.png|🍻🍺
```

# License
This project is licensed under the MIT license, which can be found in the `LICENSE` file.

# Contributors

Rph: [https://github.com/rphsoftware](https://github.com/rphsoftware)

Riesi: [https://github.com/Riesi](https://github.com/Riesi)
