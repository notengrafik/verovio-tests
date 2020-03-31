const assert = require('assert').strict;
const expect = require('chai').expect;
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
  const [mei, meiError] = loadXML(testcase.meiPath);
  const [svg, svgError] = loadXML(testcase.svgPath);

  describe(testcase.meiName, function() {
    if (testcase.errors.length > 0) {
      it("should compile", function() {
        assert.fail(testcase.errors.join("\n"));
      });
      return;
    }
    if (!svg || !mei) {
      it(`should load ${!mei ? "mei" : "svg"} files`, function() {
        assert.fail(!mei ? meiError : svgError);
      });
      return;
    }

    if (testcase.tests.length === 0) {
      it("should have test annotations", function() {
        assert.fail();
      });
    }

    for (const test of testcase.tests) {
      try {
        it(test.label, async function() {
          eval(test.test);
        });
      } catch (e) {
        it("test syntax should be correct", function() {
          assert.fail(e.message);
        });
      }
    }
  });
}
