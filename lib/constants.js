const path = require("path");

const outputPath = "testout";

module.exports = {
  inputPath: "test",
  outputPath: outputPath,
  testcasesJSON: path.join(outputPath, "testcases.json"),
}
