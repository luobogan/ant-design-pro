/** @type {import('@utoo/pack').LoaderFactory} */
module.exports = function mdRawLoader(source) {
  return `export default ${JSON.stringify(source)};`;
};
