const rect1 = new DOMParser().parseFromString(`
  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">
    <rect id="rect1" width="1" height="3" x="2" fill="red"/>
    <rect id="rect2" width="1" height="3" x="5" fill="red"/>
    <rect id="rect3" width="1" height="3" x="5" y="4" fill="red"/>
  </svg>
`, "image/svg+xml");


const distance = require('../distance');
const assert = require('assert');
const expect = require('chai').expect;

describe('distance calculation with canvas', function() {
  it('compares an image with itself', async function() {
    const d = await distance(rect1, "rect", "rect");
    expect(d).to.equal(0);
  });
  it('compares horizontally displaced images', async function() {
    const d = await distance(rect1, "#rect1", "#rect2");
    expect(d).to.equal(3);
  });
  it('compares diagonally displaced images', async function() {
    const d = await distance(rect1, "#rect1", "#rect3");
    expect(d).to.equal(3);
  });
});
