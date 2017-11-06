var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  nocI18nRoot = "lib/canada-national-occupational-classification/i18n/",
  rootI18nRoot = "src/i18n/",
  sgcDataUrl = "lib/statcan_sgc/sgc.json",
  nocDataUrl = "lib/canada-national-occupational-classification/noc.json",
  canadaOccupationsDataUrl = "data/census_occupations.json",
  container = d3.select(".occupations .data"),
  canadaSgc = "01",
  currentSgcId = canadaSgc,
  settings = {},
  showData = function() {

  },
  nocData, canadaOccupationsData, sgcData;

i18n.load([sgcI18nRoot, nocI18nRoot, rootI18nRoot], function() {
  d3.queue()
    .defer(d3.json, sgcDataUrl)
    .defer(d3.json, nocDataUrl)
    .defer(d3.json, canadaOccupationsDataUrl)
    .await(function(error, sgcs, noc, occupations) {
      sgcData = sgcs;
      nocData = noc;
      canadaOccupationsData = occupations;

      showData();
    });
});
