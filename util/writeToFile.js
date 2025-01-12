const fs = require('fs')
const path = require('path')

function writeToFile(json, {
    filePath = './debug.json',
    alreadyString = false
}) {
    // const dirname = path.dirname(filePath)
    // if (!fs.existsSync(dirname)) {
    //     fs.mkdirSync(dirname, { recursive: true });
    // }
    fs.writeFile(
        filePath,
        alreadyString ? json : JSON.stringify(json, null, 2),
        null,
        () => {}
    );
}

module.exports = {
    writeToFile
}