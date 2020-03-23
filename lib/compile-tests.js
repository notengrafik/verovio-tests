const fs = require('fs-extra');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const DOMParser = require('xmldom').DOMParser;
const XMLSerializer = require('xmldom').XMLSerializer;

const constants = require('./constants');

const meiTemplate = new DOMParser().parseFromString(`
  <mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="4.0.0">
    <meiHead>
      <fileDesc>
        <titleStmt>
          <title/>
        </titleStmt>
        <pubStmt/>
      </fileDesc>
    </meiHead>
    <music>
      <body>
        <mdiv>
          <score>
            <scoreDef>
              <staffGrp>
                <staffDef clef.shape="G" clef.line="2" meter.sym="common" n="1" lines="5"/>
              </staffGrp>
            </scoreDef>
            <section>
              <measure n="1">
                <staff n="1">
                  <layer n="1"/>
                </staff>
              </measure>
            </section>
          </score>
        </mdiv>
      </body>
    </music>
  </mei>
`);
const supportedRootElements = {
  mei: true,
  music: true,
  body: true,
  mdiv: true,
  score: true,
  section: true,
  measure: true,
  staff: true,
  layer: true,
};


function handleAnnot(annot, testcase) {
  const type = annot.getAttribute("type");
  switch (type) {
    case "test":
      const label = annot.getAttribute("label");
      if (!label) {
        errors.push("test annot needs a label attribute");
        break;
      }
      testcase.tests.push({
        label: label,
        test: annot.textContent,
      });
      break;
    case "verovio-options":
      try {
        testcase.verovioOptions = JSON.parse(annot.textContent);
      } catch(e) {
        errors.push("error parsing verovio-options annot\n" + e.message);
      }
      break;
    default:
      testcase.errors.push(
        (type ? ("Found annot type: " + type) : "No annot type found.")
        + " To prevent accidentally passing tests because of mistyped annot"
        + " types, only 'test' or 'verovio-options' are supported."
      );
  }
  annot.parentNode.removeChild(annot);
}


const randomXmlName = (function() {
  const nameAlphabet = [..."abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ-.0123456789"];
  // According to XML name rules, first character must be a letter, "_" or ":".
  // Subsequent ones can also be digits, "." or "-". ":" is special, we exclude 
  // it.
  const initialAlphabetLength = nameAlphabet.indexOf("-");

  return function randomXmlName(length) {
    let maxIndex = initialAlphabetLength;
    let id = "";
    for (let i = length; i > 0; i--) {
      id += nameAlphabet[Math.floor(Math.random() * maxIndex)];
      maxIndex = nameAlphabet.length;
    }
    return id;
  }
})();


/**
 * Traverses MEI, adding IDs where missing, extracting test and options annots.
 */
function addIdsAndParseAnnots(mei, testcase) {
  const elements = mei.getElementsByTagName("*");
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element.getAttribute("xml:id")) {
      element.setAttribute("xml:id", randomXmlName(6));
    }
    if (element.tagName === "annot") {
      handleAnnot(element, testcase);
    }
  }
}


function firstElementChild(element) {
  for (let child of element.childNodes) {
    if (child.nodeType === child.ELEMENT_NODE) {
      return child;
    }
  }
}


function replaceElement(oldElement, newElement) {
  oldElement.parentNode.replaceChild(newElement, oldElement);
}


function prepareTestcase(fileName) {
  const meiPath = path.join(constants.outputPath, fileName);
  const testcase = {
    meiName: fileName,
    meiPath: meiPath,
    svgPath: meiPath.replace(/\.mei$/, '.svg'),
    tests: [],
    errors: [],
    verovioOptions: null,
  };

  const xmlString = fs.readFileSync(
    path.join(constants.inputPath, fileName),
    {encoding: 'utf8'}
  );
  // To reduce repetitive boilerplate code, we allow test documents to start
  // with any element up to the layer element. We insert it into the template.
  const testSnippet = new DOMParser().parseFromString(xmlString).documentElement;
  const mei = meiTemplate.cloneNode(true);
  if (!supportedRootElements[testSnippet.tagName]) {
    testcase.errors.push(
      `unsupported root element <${testSnippet.tagName}>\n`
      + "supprted elements:\n"
      + Object.keys(supportedRootElements).map(tag => `  * <${tag}>`).join("\n")
    );
    return testcase;
  }
  const replacementPoint = mei.getElementsByTagName(testSnippet.tagName)[0];
  replaceElement(replacementPoint, testSnippet);

  addIdsAndParseAnnots(mei, testcase);

  fs.writeFileSync(meiPath, new XMLSerializer().serializeToString(mei));

  if (testcase.tests.length === 0) {
    testcase.errors.push("test annots are missing");
  }
  return testcase;
}


function constructVerovioArgs(testcase) {
  const args = ["--breaks", "encoded"];
  if (testcase.verovioOptions) {
    for (const [key, value] of Object.entries(testcase.verovioOptions)) {
      // Convert from JSON style camel case to command line style kebab case
      args.push("--" + key.replace(/[A-Z]/g, c => "-" + c.toLowerCase()));
      // If the value is just "true" then we have a flag, so don't include
      // the value in the command line arguments
      if (value !== true) {
        args.push(toString(value));
      }
    }
  }
  return args.concat(["-o", testcase.svgPath, testcase.meiPath]);
}


const testcases = [];

fs.removeSync(constants.outputPath);
fs.ensureDirSync(constants.outputPath);


for (const fileName of fs.readdirSync("test")) {
  if (path.extname(fileName) === ".mei") {
    const testcase = prepareTestcase(fileName);
    testcases.push(testcase);

    const args = constructVerovioArgs(testcase);
    const result = spawnSync("verovio", args, {encoding: 'utf8'});
    if (result.status !== 0) {
      testcase.errors.push(result.stderr || "Verovio error");
    }
  }
}


fs.writeFileSync(constants.testcasesJSON, JSON.stringify(testcases));
