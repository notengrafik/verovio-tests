const assert = require('assert').strict;
const path = require('path');
const constants = require('./constants');


function loadXML(path) {
  const mime = path.match(/\.svg$/) ? "image/svg+xml" : "text/xml";
  const xhr = new XMLHttpRequest();
  xhr.open("GET", path, false);
  xhr.send(null);
  if (xhr.status === 200) {
    try {
      return [new DOMParser().parseFromString(xhr.responseText, mime)];
    } catch (e) {
      return [null, e.message];
    }
  } else {
    return [null, xhr.statusText];
  }
}


function loadJSON(path) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", path, false);
  xhr.send(null);
  if (xhr.status === 200) {
    try {
      return [JSON.parse(xhr.responseText)]
    } catch (e) {
      return [null, e.message];
    }
  } else {
    return [null, xhr.statusText];
  }
}


const [testcases, jsonError] = loadJSON(constants.testcasesJSON);
if (jsonError) {
  describe("Testacase loading", function() {
    it("should load " + constants.testcasesJSON, function() {
      assert.fail(jsonError);
    });
  });
  return;
}


for (const testcase of testcases) {
  const meiPath = path.join(constants.inputPath, testcase.path) + ".mei";
  const svgPath = path.join(constants.outputPath, testcase.path) + ".svg";
  const [mei, meiError] = loadXML(meiPath);
  const [svg, svgError] = loadXML(svgPath);

  describe(testcase.path, function() {
    if (testcase.verovioError) {
      it("should compile", function() {
        assert.fail(testcase.verovioError);
      });
      return;
    }
    if (!svg || !mei) {
      it(`should load ${!mei ? "mei" : "svg"} files`, function() {
        assert.fail(!mei ? meiError : svgError);
      });
      return;
    }
    for (const testAnnot of mei.querySelectorAll("annot[type=test]")) {
      it(testAnnot.getAttribute("label"), function() {
        eval(testAnnot.textContent);
      });
    }
  });
}
