const distanceTransform = require('distance-transform');
const ndarray = require('ndarray');


/**
 * @param  {SVGDocument|SVGSVGElement} svg
 * @param  {string} selector CSS selector
 * @return {SVGDocument|SVGSVGElement} A clone of the input svg with all
 * elements except for the (first) element matching the selector are hidden.
 */
function reduceSvgToElement(svg, selector) {
  svg = svg.cloneNode(true);
  let element = svg.querySelector(selector);
  if (!element) {
    throw new Error("Could not resolve selector " + selector);
  }

  while (element) {
    for (const selectNext of ["previousElementSibling", "nextElementSibling"]) {
      let next = element[selectNext];
      while (next) {
        next.setAttribute("display", "none");
        next = next[selectNext];
      }
    }
    element = element.parentNode;
  }

  return svg;
}


/**
 * @param  {SVGDocument|SVGSVGElement} svg
 * @return {string}
 */
function svgToDataUri(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURI(
    new XMLSerializer().serializeToString(svg)
  );
}


/**
 * @param  {SVGDocument|SVGSVGElement} svg
 * @return {Promise<HTMLImageElement>} Fully loaded `<img>` element using the
 * svg as data URI.
 */
function svgToImg(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject("Failed to load SVG as image");
    img.src = svgToDataUri(svg);
  });
}


/**
 * TODO: A scale argument to influence the distance value precision
 * @param  {SVGDocument|SVGSVGElement} svg
 * @return {ImageData} Has the same width and height as `svg`
 */
async function svgToImageData(svg) {
  svg = svg.documentElement || svg;
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const img = await svgToImg(svg);
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, width, height);
}


/**
 * @param  {ImageData} data1 (Don't re-use `data1` after passing it to this
 * function – it gets manipulated.)
 * @param  {ImageData} data2
 * @return {number} Distance between `data1` and `data2` in the sense: smallest
 * possibe distance between their edges within an error tolerance of around ±√2.
 */
function distanceBetweenImages(data1, data2) {
  // Though we want to know the distance between edges and the distance
  // transform calculates distances between centers of pixels, that's OK because
  // distance is generally underestimated. The reason is that although the image
  // is semi-transparent, the distance map looks at it as a binary image, i.e.
  // treats semi-transparent pixels (i.e. antialiased pixels) the same as fully
  // opaque ones. To illustrate, we compare pairs of one-column images (images
  // labeled 1 and 2, # being a fully opaque pixel, + semi-transparent, . a
  // transparent pixel):
  //                                                   1 2
  //                                             1 2   # .
  //                                       1 2   # .   + .
  //                                 1 2   # .   + .   . .
  // images                    1 2   # +   + +   . +   . +
  //                           # #   + #   . #   . #   . #
  // calculated distance:      0     0     0     1     2
  // actual distance between:  0     0     0-1   0-2   1-3
  //
  // This means the calculated distance lies right in the center of the interval
  // of possible actual distances if the calculated distance is 1 or greater.
  // (If it was really important, the cases where the calculated distance is 0
  // could be further examined with O(n) effort, but hey, we're dealing with a
  // rasterized image that doesn't represent the vector image faithfully
  // anyway.)
  //
  // At an angle, the situation is analogous. E.g. diagonally, all the above
  // example distances would have to be scaled by factor √2.
  const {width, height} = data1;
  [data1, data2] = [data1.data, data2.data];
  const end = data1.length / 4;
  // We move all the alpha values to the start of the array so that ndarray can
  // work with it
  for (let i = 0; i < end; i++) {
    data1[i] = data1[i * 4 + 3] > 0 ? 1 : 0;
  }
  distanceTransform(ndarray(data1, [width, height]));
  let minDist = Infinity;
  for (let i = 0; i < end; i++) {
    const alpha2 = data2[i * 4 + 3];
    if (alpha2 > 0) {
      const dist = data1[i];
      if (dist < minDist) {
        minDist = dist;
      }
    }
  }
  return minDist;
}


/**
 * @param  {SVGDocument|SVGSVGElement} svg
 * @param  {string} selector1 CSS selector
 * @param  {string} selector2 CSS selector
 * @return {Promise<number>} The shortest distance between the shapes selected
 * by the CSS selectors. In global SVG units within an error tolerance of around
 * ±√2.
 */
module.exports = async function distance(svg, selector1, selector2) {
  const selectors = [selector1, selector2];
  const imageData = [];
  for (let i = 0; i < 2; i++) {
    const reducedSvg = reduceSvgToElement(svg, selectors[i]);
    imageData[i] = await svgToImageData(reducedSvg);
  }
  return distanceBetweenImages(...imageData);
}
