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
  getNocId = function(nocElmId) {
    return nocElmId.replace(nocIdPrefix, "")
  },
  showData = function() {
    var bindData = function(data) {
        var clone = [],
          recurse = function(arr, parent) {
            var n, noc, newNoc;
            for (n = 0; n < arr.length; n++) {
              noc = arr[n];
              newNoc = {
                id: noc.id
              };

              if (noc.children !== undefined) {
                newNoc.children = [];
                recurse(noc.children, newNoc);
              }

              if (Array.isArray(parent)) {
                parent.push(newNoc);
              }
              else if (typeof parent === "object") {
                parent.children.push(newNoc);
                newNoc.parent = parent;
              }

              newNoc[state.property] = canadaOccupationsData.getDataPoint($.extend({}, state, {noc: noc.id}));
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
      binded = bindData(nocData);

    // TODO: Remove when using the components
    (function() {
      var pre = container.select("pre");
      if (!pre.empty()) {
        pre.remove();
      }
      pre = container.append("pre");

      var recurse = function(arr, level) {
        var n, noc;
        for (n = 0; n < arr.length; n++) {
          noc = arr[n];
          i18next.t(noc.id, {ns: nocNs});
          pre.append("div")
            .attr("id", nocIdPrefix + noc.id)
            .attr("class", function() {
              var up = noc,
                level = 1;

              while (up.parent !== undefined) {
                up = up.parent;
                level++;
              }

              return rootNocClassPrefix + up.id + " " + nocLvlPrefix + level;
            })
            .text(
              Array(level).fill("  ").join("") + i18next.t(noc.id, {ns: nocNs}) + "\t" + noc[state.property]
            );
          if (noc.children !== undefined) {
            recurse(noc.children, ++level);
            --level;
          }
        }
      };
      recurse(binded, 0);
    })();
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
      percent = workers / canadaOccupationsData.getDataPoint($.extend({}, point, {noc: allNoc}));

    console.log([i18next.t(nocId, {ns: nocNs}), workersFormatter.format(workers), salaryFormatter.format(medianIncome), percentFormatter.format(percent)])
  },
  onHoverFx = function(e) {
    var hoverTopClass = "hover",
      hoverClass = "hovering",
      getNocSelector = function(nocId) {
        return "#" + nocIdPrefix + nocId;
      },
      hoverIn = function() {
        var nocId = getNocId(e.target.id),
          noc = nocData.getNoc(nocId),
          selector = getNocSelector(nocId),
          up = noc;
        container.classed(hoverTopClass, true);

        while (up.parent !== undefined) {
          up = up.parent;
          selector += "," + getNocSelector(up.id);
        }

        container.selectAll("." + hoverClass).classed(hoverClass, false);
        container.selectAll(selector).classed(hoverClass, true);
      },
      hoverOut = function() {
        container.classed(hoverTopClass, false);

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
      $(document).on("mouseover mouseout click", ".data div", onHover);
    });
});
