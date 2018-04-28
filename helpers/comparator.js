const comparator = {};

// comparator.comparatorNumericDynamic = function (property) {
//   return function (a, b) {
//     console.log(a, b);
//     return a[property] - b[property];
//   };
// };
//
// comparator.comparatorDateDynamic = function (property) {
//   return function (a, b) {
//     return new Date(a[property]) - new Date(b[comparator]);
//   };
// };
//
// comparator.comparatorStringDynamic = function (property) {
//   return function (a, b) {
//     return a[property].localeCompare(b[property]);
//   };
// };

comparator.comparatorNumeric = function (a, b) {
  return a - b;
};

comparator.comparatorDate = function (a, b) {
  return new Date(a) - new Date(b);
};

comparator.comparatorString = function (a, b) {
  return a.localeCompare(b);
};

module.exports = comparator;