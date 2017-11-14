var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  nocI18nRoot = "lib/canada-national-occupational-classification/i18n/",
  rootI18nRoot = "src/i18n/",
  sgcDataUrl = "lib/statcan_sgc/sgc.json",
  nocDataUrl = "lib/canada-national-occupational-classification/noc.json",
  canadaOccupationsDataUrl = "data/census_occupations.json",
  rootNs = "census_occupations",
  nocNs = "noc",
  container = d3.select(".occupations .data"),
  canadaSgc = "01",
  state = {
    sgc: canadaSgc,
    hcdd: 1,
  },
  showData = function() {
    var recurse = function(arr, level) {
      var n, noc;
      for (n = 0; n < arr.length; n++) {
        noc = arr[n];
        i18next.t(noc.id, {ns: nocNs});
        console.log([
          Array(level).fill("  ").join("") + i18next.t(noc.id, {ns: nocNs}),
          canadaOccupationsData.getDataPoint($.extend({}, state, {noc: noc.id, property: "med_earnings"})),
          canadaOccupationsData.getDataPoint($.extend({}, state, {noc: noc.id, property: "count_elf_fyft"}))
        ]);
        if (noc.children !== undefined) {
          recurse(noc.children, ++level);
          --level;
        }
      }
    };

    recurse(nocData.roots, 0);
  },
  onSelect = function(e) {
    switch(e.target.id){
    case "sgc":
      state.sgc = e.target.value;
      break;
    case "hcdd":
      state.hcdd = parseInt(e.target.value, 10);
      break;
    }
    showData();
  },
  nocData, canadaOccupationsData, sgcData;

i18n.load([sgcI18nRoot, nocI18nRoot, rootI18nRoot], function() {
  d3.queue()
    .defer(d3.json, sgcDataUrl)
    .defer(d3.json, nocDataUrl)
    .defer(d3.json, canadaOccupationsDataUrl)
    .await(function(error, sgcs, noc, occupations) {
      sgcData = sgcs;
      nocData = canada_noc(noc);
      canadaOccupationsData = require("canada_census_data")(occupations);

      showData();

      $(document).on("change", ".occupations", onSelect);
    });
});
