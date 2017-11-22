var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  nocI18nRoot = "lib/canada-national-occupational-classification/i18n/",
  rootI18nRoot = "src/i18n/",
  sgcDataUrl = "lib/statcan_sgc/sgc.json",
  nocDataUrl = "lib/canada-national-occupational-classification/noc.json",
  canadaOccupationsDataUrl = "data/census_occupations.json",
  rootNs = "census_occupations",
  nocNs = "noc",
  container = d3.select(".occupations .data"),
  chart = container.append("svg")
    .attr("id", "census_occupations"),
  canadaSgc = "01",
  allNoc = "X",
  rootNocClassPrefix = "rootnoc_",
  nocIdPrefix = "noc",
  nocLvlPrefix = "lvl",
  workersProp = "count_elf_fyft",
  medIncProp = "med_earnings",
  state = {
    sgc: canadaSgc,
    hcdd: 1,
    property: workersProp
  },
  workersFormatter = i18n.getNumberFormatter(0),
  salaryFormatter = {
    _formatter: i18n.getNumberFormatter({
      style: "currency",
      currency: "CAD",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }),
    format: function() {
      var output = this._formatter.format.apply(this, arguments);
      return output.replace("CA", "");
    }
  },
  percentFormatter = {
    _formatter: i18n.getNumberFormatter({
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    cutOff: 1 / 10000,
    format: function(value) {
      if (value > 0 && value < this.cutOff)
        return "< " + this._formatter.format(this.cutOff);

      return this._formatter.format(value);
    }
  },
  settings = {
    aspectRatio: 16 / 12,
    getId: function(d) {
      return nocIdPrefix + d.data.nocId;
    },
    getValue: function(d) {
      if (d.children === undefined)
        return d[state.property];
      return 0;
    },
    getClass: function(d) {
      var up = d,
        level = 1,
        rootId;

      while (up.parent !== undefined && up.parent !== null && up.parent.data.nocId !== undefined) {
        up = up.parent;
        level++;
      }

      rootId = up.data.nocId;

      if (rootId !== undefined)
        return rootNocClassPrefix + rootId + " " + nocLvlPrefix + level;

      return "root";
    }
  },
  getNocId = function(nocElmId) {
    return nocElmId.replace(nocIdPrefix, "");
  },
  showData = function() {
    var bindData = function(data) {
        var clone = [],
          recurse = function(arr, parent) {
            var n, noc, binding;
            for (n = 0; n < arr.length; n++) {
              noc = arr[n];
              binding = {
                nocId: noc.id
              };

              if (noc.children !== undefined) {
                binding.children = [];
                recurse(noc.children, binding);
              }

              if (Array.isArray(parent)) {
                parent.push(binding);
              }
              else if (typeof parent === "object") {
                parent.children.push(binding);
              }

              binding[state.property] = canadaOccupationsData.getDataPoint($.extend({}, state, {noc: noc.id}));
            }
          },
          noc;

        if (state.noc === undefined ) {
          recurse(data.roots, clone);
        } else {
          noc = nocData.getNoc(state.noc);
          if (noc.children !== undefined) {
            recurse(noc.children, clone);
          } else {
            recurse([noc], clone);
          }
        }

        return clone;
      },
      data = {
        children: bindData(nocData)
      };

    sunburstChart(chart, settings, data);
  },
  onSelect = function(e) {
    switch(e.target.id){
    case "noc":
      state.noc = e.target.value !== allNoc ? getNocId(e.target.value) : undefined;
      break;
    case "sgc":
      state.sgc = e.target.value;
      break;
    case "hcdd":
      state.hcdd = parseInt(e.target.value, 10);
      break;
    }
    showData();
  },
  onHover = function() {
    onHoverText.apply(this, arguments);
    onHoverFx.apply(this, arguments);
  },
  onHoverText = function(e) {
    var nocId = getNocId(e.target.id),
      point = {
        sgc: state.sgc,
        hcdd: state.hcdd,
        noc: nocId,
        property: workersProp
      },
      workers = canadaOccupationsData.getDataPoint(point),
      medianIncome = canadaOccupationsData.getDataPoint($.extend({}, point, {property: medIncProp})),
      percent = workers / canadaOccupationsData.getDataPoint($.extend({}, point, {noc: allNoc})),
      text;

    text = "----" + "\n" + i18next.t(nocId, {ns: nocNs}) + "\n\n";
    text += i18next.t("average_inc", {ns: rootNs}) + "\n" + salaryFormatter.format(medianIncome) + "\n\n";
    text += i18next.t("num_ppl", {ns: rootNs}) + "\n" + workersFormatter.format(workers) + "\n\n";
    text += i18next.t("pct_ppl", {ns: rootNs}) + "\n" + percentFormatter.format(percent);

    console.log(text);
  },
  onHoverFx = function(e) {
    var hoverTopClass = "hover",
      hoverClass = "hovering",
      getNocSelector = function(nocId) {
        return "#" + nocIdPrefix + nocId;
      },
      hoverIn = function() {
        var nocId = getNocId(e.target.parentNode.id),
          noc = nocData.getNoc(nocId),
          selector = getNocSelector(nocId),
          up = noc;
        chart.classed(hoverTopClass, true);

        while (up.parent !== undefined) {
          up = up.parent;
          selector += "," + getNocSelector(up.id);
        }

        chart.selectAll("." + hoverClass).classed(hoverClass, false);
        chart.selectAll(selector).classed(hoverClass, true);
      },
      hoverOut = function() {
        chart.classed(hoverTopClass, false);
      };

    clearTimeout(hoverTimeout);
    switch (e.type) {
    case "mouseover":
      hoverIn();
      break;
    case "mouseout":
      hoverTimeout = setTimeout(hoverOut, 100);
    }
  },
  nocData, canadaOccupationsData, sgcData, hoverTimeout;

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
      $(document).on("mouseover mouseout click", ".data .arc", onHover);
    });
});
