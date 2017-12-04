var sgcI18nRoot = "lib/statcan_sgc/i18n/sgc/",
  nocI18nRoot = "lib/canada-national-occupational-classification/i18n/",
  rootI18nRoot = "src/i18n/",
  nocDataUrl = "lib/canada-national-occupational-classification/noc.json",
  canadaOccupationsDataUrl = "data/census_occupations.json",
  rootNs = "census_occupations",
  nocNs = "noc",
  container = d3.select(".occupations .data"),
  chart = container.append("svg")
    .attr("id", "census_occupations")
    .attr("focusable", "false"),
  canadaSgc = "01",
  allNoc = "X",
  rootNocClassPrefix = "rootnoc_",
  nocIdPrefix = "noc",
  nocLvlPrefix = "lvl",
  workersProp = "count_elf_fyft",
  medIncProp = "med_earnings",
  hoverTopCl = "hover",
  selectedCl = "selected",
  noDataCl = "no-data",
  state = {
    sgc: "61",
    hcdd: 1,
    property: workersProp,
    noc: "2131"
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
    margin: {
      top: 50
    },
    padding: 0,
    aspectRatio: 16 / 12,
    innerRadius: 175,
    getId: function(d) {
      return nocIdPrefix + (d.data.nocId ? d.data.nocId : allNoc);
    },
    getValue: function(d) {
      if (d.children === undefined)
        return d[state.property];
      return 0;
    },
    getText: function(d) {
      if (d.data.nocId === undefined && this.zoom !== nocIdPrefix + allNoc)
        return i18next.t("home", {ns: rootNs}).split("").join("\u2009");

      if (d.value > 0) {
        return i18next.t(d.data.nocId, {ns: nocNs}).split("").join("\u2009");
      }
      return "";
    },
    getClass: function(d) {
      var up = d,
        level = 1,
        zoomLevel = 1,
        rootId,
        cl = "",
        zoomNoc;

      while (up.parent !== undefined && up.parent !== null && up.parent.data.nocId !== undefined) {
        up = up.parent;
        level++;
      }
      rootId = up.data.nocId;

      if (rootId !== undefined) {
        cl += rootNocClassPrefix + rootId + " " + nocLvlPrefix + level;

        if (this.zoom !== nocIdPrefix + allNoc) {
          zoomNoc = nocData.getNoc(this.zoom.replace(nocIdPrefix, ""));
          up = zoomNoc;
          while (up.parent !== undefined && up.parent !== null && up.parent.id !== undefined) {
            up = up.parent;
            zoomLevel++;
          }

          if (rootId === up.id && level < 4 && level <= zoomLevel)
            cl += " " + selectedCl;
        }
      } else {
        cl += "root";
      }

      return cl;
    },
    zoomCallback: function(id) {
      var up;
      this.zoom = id;
      state.noc = id.replace(nocIdPrefix, "");
      document.getElementById("noc").value = state.noc;

      d3.selectAll("." + selectedCl).classed(selectedCl, false);
      d3.select("." + hoverTopCl).classed(hoverTopCl, false);

      up = nocData.getNoc(state.noc);

      if (up !== undefined && up.id.length === 4)
        up = up.parent;

      while (up !== undefined) {
        d3.select("#" + nocIdPrefix + up.id).classed(selectedCl, true);
        up = up.parent;
      }
      showValues();
    },
    width: 600
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
          };

        recurse(data.roots, clone);
        return clone;
      },
      data = {
        children: bindData(nocData)
      };

    settings.zoom = nocIdPrefix + state.noc;
    chartObj = sunburstChart(chart, settings, data);
    showValues();
  },
  showValues = function(sett) {
    var info = chart.select(".info"),
      titleObj = chart.select(".info-title"),
      title, mid, workers, medianIncome, percent;

    sett = sett || state;
    workers = canadaOccupationsData.getDataPoint(sett);
    medianIncome = canadaOccupationsData.getDataPoint($.extend({}, sett, {property: medIncProp}));
    percent = workers / canadaOccupationsData.getDataPoint($.extend({}, sett, {noc: allNoc}));

    title = i18next.t(sett.noc, {ns: [nocNs, rootNs]});
    titleObj.text(title);

    if (titleObj.node().getSubStringLength(0, title.length) > settings.width * 3 /4) {
      titleObj.text(null);
      mid =  title.indexOf(" ", Math.ceil(title.length / 2));
      titleObj.append("tspan").text(title.slice(0, mid));
      titleObj.append("tspan")
        .attr("x", 300)
        .attr("dy", "1.2em")
        .text(title.slice(mid));
    }

    info.select(".income").text(salaryFormatter.format(medianIncome));
    info.select(".num").text(workersFormatter.format(workers));
    info.select(".pt").text(percentFormatter.format(percent));


    chart.classed(noDataCl, workers === 0);
  },
  onSelect = function(e) {
    switch(e.target.id){
    case "noc":
      state.noc = e.target.value;
      chartObj.zoom(nocIdPrefix + state.noc);
      return;
    case "sgc":
      state.sgc = e.target.value;
      break;
    case "hcdd":
      state.hcdd = parseInt(e.target.value, 10);
      break;
    }
    showData();
  },
  onHover = function(e) {
    var hoverClass = "hovering",
      getNocSelector = function(nocId) {
        return "#" + nocIdPrefix + nocId;
      },
      hoverIn  = function() {
        var nocId = getNocId(e.target.parentNode.id),
          noc = nocData.getNoc(nocId),
          selector = getNocSelector(nocId),
          up = noc;

        if (up === undefined) {
          hoverOut();
          return;
        }

        // Hover Arcs effect
        chart.classed(hoverTopCl, true);

        while (up.parent !== undefined) {
          up = up.parent;
          selector += "," + getNocSelector(up.id);
        }

        chart.selectAll("." + hoverClass).classed(hoverClass, false);
        chart.selectAll(selector).classed(hoverClass, true);

        // Update info text
        showValues({
          sgc: state.sgc,
          hcdd: state.hcdd,
          noc: nocId,
          property: workersProp
        });
      },
      hoverOut = function() {
        chart.classed(hoverTopCl, false);
        showValues();
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
  nocData, canadaOccupationsData, hoverTimeout, chartObj;

i18n.load([sgcI18nRoot, nocI18nRoot, rootI18nRoot], function() {
  d3.queue()
    .defer(d3.json, nocDataUrl)
    .defer(d3.json, canadaOccupationsDataUrl)
    .await(function(error, noc, occupations) {
      var info, noData;

      nocData = canada_noc(noc);
      canadaOccupationsData = require("canada_census_data")(occupations);

      chart.append("text")
        .attr("class", "info-title")
        .attr("aria-hidden", "true")
        .attr("x", settings.width / 2)
        .attr("dy", "1em");

      info = chart.append("text")
        .attr("aria-hidden", "true")
        .attr("x", settings.width / 2)
        .attr("y", 195)
        .attr("class", "info");

      info.append("tspan")
        .attr("class", "h6")
        .text(i18next.t("average_inc", {ns: rootNs}));

      info.append("tspan")
        .attr("x", settings.width / 2)
        .attr("y", 195)
        .attr("dy", "1.4em")
        .attr("class", "income value");

      info.append("tspan")
        .attr("x", settings.width / 2)
        .attr("y", 245)
        .attr("class", "h6")
        .text(i18next.t("num_ppl", {ns: rootNs}));

      info.append("tspan")
        .attr("x", settings.width / 2)
        .attr("y", 245)
        .attr("dy", "1.4em")
        .attr("class", "num value");

      info.append("tspan")
        .attr("x", settings.width / 2)
        .attr("y", 295)
        .attr("class", "h6")
        .text(i18next.t("pct_ppl", {ns: rootNs}));

      info.append("tspan")
        .attr("x", settings.width / 2)
        .attr("y", 295)
        .attr("dy", "1.4em")
        .attr("class", "pt value");

      noData = chart.append("text")
        .attr("class", "no-data-title")
        .attr("x", settings.width / 2)
        .attr("y", 80);

      noData.append("tspan")
        .attr("class", "glyphicon")
        .text("\ue090");

      noData.append("tspan")
        .attr("dy", -2)
        .attr("dx", ".25em")
        .text(i18next.t("no_data", {ns: rootNs}));

      showData();

      $(document).on("change", ".occupations", onSelect);
      $(document).on("mouseover mouseout click", ".data .arc", onHover);
    });
});
