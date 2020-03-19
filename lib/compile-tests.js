const fs = require('fs-extra');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const constants = require('./constants');

const testcases = [];

fs.removeSync(constants.outputPath);
fs.ensureDirSync(constants.outputPath);

for (const fileName of fs.readdirSync("test")) {
  if (path.extname(fileName) === ".mei") {
    const basePath = fileName.replace(/\.mei$/, '');
    const meiPath = path.join(constants.inputPath, fileName);
    const svgPath = path.join(constants.outputPath, basePath + ".svg");

    const testcase = {
      path: basePath,
      tests: []
    }
    testcases.push(testcase);

    let result;
    try {
      result = spawnSync("verovio", ["-o", svgPath, "--breaks", "encoded", meiPath], {encoding: 'utf8'});
    } catch (e) {
      testcase.verovioError = result;
      continue;
    }
  }
}


fs.writeFileSync(constants.testcasesJSON, JSON.stringify(testcases));
