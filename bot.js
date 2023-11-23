require('dotenv').config();
const fs = require('fs').promises;
const { F_OK } = require('fs').constants;
const { access } = require('fs');
const { join } = require('path');
const path = require('path');
const { execSync } = require('child_process');
const {Telegram} = require("telegraf");
const inquirer = require('inquirer');

const exists = s => new Promise(r=>access(s, F_OK, e => r(!e)));
const hash = s => require('crypto').createHash('sha256').update(s).digest('base64');
(async function run() {
    if (!await exists(process.env.REPO)) {
        await fs.mkdir(process.env.REPO, {recursive: true})
    }

    await git();
    
    let setName = process.env.SSNAME;
    let setTitle = process.env.SSTITLE;

    let apiClient = new Telegram(process.env.TG_TOKEN);

    console.log("Loading pack locations");
    let packs_dir = join(process.env.REPO, "git_repo", "telegram_packs");
    let packs = await fs.readdir(packs_dir);

    //get root pack from base svg folder
    let root_svg_dir = join(process.env.REPO, "git_repo", "svg");
    let root_svgs = "";
    let root_svgs_dir_content = await fs.readdir(root_svg_dir);
    for (file of root_svgs_dir_content) {
        let fileDetails = await fs.stat(path.resolve(root_svg_dir, file));
        if (fileDetails.isFile()) {
            file = file.replace(".svg","");
            root_svgs = root_svgs+file+'\n';
        }
    };
    let root_defs = await load_pack_definitions(root_svgs);
    await handle_stickers(apiClient, "main", setName, `${setTitle} Stickers!`, root_defs);

    // do the sticker pack magic for each defintion file^
    for (const pack of packs) {
        console.log(pack);
        let name = pack.replace(".txt","");

        let defs_file = await fs.readFile(join(packs_dir, pack), "utf-8");
        let defs = await load_pack_definitions(defs_file);
        if (defs == null){
            continue;
        }
        let name_upper = name.charAt(0).toUpperCase() + name.slice(1);
        await handle_stickers(apiClient, name, setName, `${setTitle} ${name_upper}!`, defs);
    };

})();

async function git(){
    if (!await exists(join(process.env.REPO, "git_repo"))) {
        console.log("Git repo does not exist, cloning");
        let res = execSync(`git clone ${process.env.GITREPO} git_repo`, {
            cwd: process.env.REPO
        });
    } else {
        console.log("Syncing repo");
        let res = execSync(`git fetch`, {
            cwd: join(process.env.REPO, "git_repo")
        });
        console.log(`Go to repo origin/${process.env.GITBRANCH}`);
        let resf = execSync(`git reset --hard origin/${process.env.GITBRANCH}`, {
            cwd: join(process.env.REPO, "git_repo")
        });
    }
    
    console.log("Checking out branch");
    let res = execSync(`git checkout ${process.env.GITBRANCH}`, {
        cwd: join(process.env.REPO, "git_repo")
    });
}

async function load_pack_definitions(defs){
    console.log("Loading definitions");

    let defLines = defs.split("\n").filter(a => a.length > 2);
    defs = defLines.map(a => a.split("|")).filter(a => a.length > 1).map(([file, emojis]) => ({file, emojis}));

    let defs_nomapping = defLines.map(a => a.split("|")).filter(a => a.length == 1).map(([file]) => {
        codes = file.split('-').slice(0,-1).map(a => a.replace('U',''));
        if(codes.length > 1){ // emojis with multiple codepoints
            hexCodes = codes.map(a => '0x'.concat(a));
            emojis = String.fromCodePoint(...hexCodes);
        }else{
            hexCodes = '0x'.concat(codes[0]);   
            emojis = String.fromCodePoint(hexCodes);
        }
        return ({file, emojis})
    });
    defs = defs_nomapping.concat(defs);

    if(defs.length>=120){
        console.log("Emoji List too long!\nSplitting each 120 is required! Length: "+defs.length);
        return null;
    }

    return defs;
}

async function handle_stickers(apiClient, nameSpecifier, setName, setTitle, packDefinitions){
    let me = await apiClient.getMe();


    let removalQueue = [];

    console.log("Resolving set");

    setName = `${setName}_${nameSpecifier}_by_${me.username}`;

    stateFile = join(process.env.REPO, `stickerset_state_${nameSpecifier}.json`);

    if (!await exists(stateFile)) {
        console.log("No state file found, note that all stickers in the set will be purged after a successful sync. Are you sure you want to continue?");
        let { allow } = await inquirer.prompt([
            {
                type: "confirm",
                name: "allow",
                message: "Continue anyway?"
            }
        ]);

        if (!allow) process.exit();

        await fs.writeFile(stateFile, "{}");
    }


    let candidates = {}; //hashmap of all emojis
    let knownStickers = [];
    let has = [];
    console.log("Hashing files");

    for (let {file, emojis} of packDefinitions) {
        candidates[hash(await fs.readFile(join(process.env.REPO, "git_repo", "png", "512", file+".png")))] = {
            file, emojis
        };
    }
    console.log(setName)
    try {
        await apiClient.getStickerSet(setName);
        console.log("Resolved");
    } catch(e) {
        console.log("Unable to resolve, creating sticker pack");

        let state = JSON.parse(await fs.readFile(stateFile, "utf-8"));

        let sticker;
        let firstFile;
        let firstCan;
        for (let candidate in candidates) {//only first element of dict
            firstEmoji = candidates[candidate];
            firstCan=candidate;
            break;
        }
        try {
            
            sticker = await apiClient.uploadStickerFile(process.env.OWNER, {
                source: await fs.readFile(join(process.env.REPO, "git_repo", "png", "512", firstEmoji.file+".png"))
            }, "static");

            console.log(sticker.file_id)
            console.log(sticker.file_unique_id)

            await apiClient.createNewStickerSet(process.env.OWNER, setName, setTitle, {
                emojis: firstEmoji.emojis,
                png_sticker: sticker.file_id
            });

            console.log("Uploaded sticker: " + firstEmoji.file);

            await fs.writeFile(stateFile, JSON.stringify(state));
        } catch(e) {
            console.log(e);
            console.log("Failed to upload, bailing out, shit's fucked: " + firstEmoji.file);
        }


    }

    let state = JSON.parse(await fs.readFile(stateFile, "utf-8"));

    for (let candidate in candidates) {
        if (state[candidate]) {
            has.push(candidate);
            knownStickers.push(state[candidate].tg_id);
            delete candidates[candidate];
        }
    }

    for (let candidate in state) {
        if (!candidates[candidate] && !has.includes(candidate)) {
            await apiClient.deleteStickerFromSet(state[candidate].tg_id);
            console.log(`Removed sticker which was not found in candidates list`);
            state[candidate] = undefined;
        }
    }
    
    for (let candidate in candidates) {
        let sticker;
        try {
            sticker = await apiClient.uploadStickerFile(process.env.OWNER, {
                source: await fs.readFile(join(process.env.REPO, "git_repo", "png", "512", candidates[candidate].file+".png"))
            },"static");
            let stickers_pre = (await apiClient.getStickerSet(setName)).stickers.map(a=>a.file_unique_id);
            await apiClient.addStickerToSet(process.env.OWNER, setName, {
                png_sticker: sticker.file_id,
                emojis: candidates[candidate].emojis
            });
            let stickers_post = (await apiClient.getStickerSet(setName)).stickers.map(a=>a.file_unique_id);
            sticker = stickers_post.filter(a=>!stickers_pre.includes(a));
            state[candidate] = {
                tg_id: sticker[0]
            };
            console.log("Uploaded sticker: " + candidates[candidate].file);

            await fs.writeFile(stateFile, JSON.stringify(state));
            knownStickers.push(sticker[0]);
        } catch(e) {
            console.log("Failed to upload, bailing out, shit's fucked: " + candidates[candidate].file);
        }
    }

    let set = await apiClient.getStickerSet(setName);

    for (let sticker of set.stickers) {
        if (!knownStickers.includes(sticker.file_unique_id)) {
            await apiClient.deleteStickerFromSet(sticker.file_id);
            console.log("Deleted an unknown sticker:"+sticker.file_id);
            console.log(sticker);
        }
    }
}