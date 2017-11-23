(function(extend) {
var defaults = {
  margin: {
    top: 2,
    right: 2,
    bottom: 2,
    left: 2
  },
  arcsWidth: 20,
  padding: 0.0009,
  aspectRatio: 16 / 9,
  width: 600
};

this.sunburstChart = function(svg, settings, data) {
  var mergedSettings = extend(true, {}, defaults, settings),
    outerWidth = mergedSettings.width,
    outerHeight = Math.ceil(outerWidth / mergedSettings.aspectRatio),
    innerHeight = mergedSettings.innerHeight = outerHeight - mergedSettings.margin.top - mergedSettings.margin.bottom,
    innerWidth = mergedSettings.innerWidth = outerWidth - mergedSettings.margin.left - mergedSettings.margin.right,
    chartInner = svg.select("g"),
    dataLayer = chartInner.select(".data"),
    elipsis = "...",
    transition = d3.transition()
      .duration(1000),
    draw = function() {
      var sett = this.settings,
        filteredData = (sett.filterData && typeof sett.filterData === "function") ?
          sett.filterData.call(sett, data) : data,
        outerRadius = Math.min(innerHeight, innerWidth) / 2,
        x = rtnObj.x = d3.scaleLinear()
          .range([0, 2 * Math.PI]),
        y = rtnObj.y = d3.scaleSqrt()
          .range([0, outerRadius]),
        getStartAngle = function(d) {
          return Math.max(0, Math.min(2 * Math.PI, x(d.x0)));
        },
        getEndAngle = function(d) {
          return Math.max(0, Math.min(2 * Math.PI, x(d.x1)));
        },
        arc = d3.arc()
          .startAngle(getStartAngle)
          .endAngle(getEndAngle)
          .innerRadius(function(d) { return Math.max(0, y(d.y0)); })
          .outerRadius(function(d) { return Math.max(0, y(d.y1)); }),
        valueFn = sett.getValue ? sett.getValue.bind(sett) : null,
        arcsIdFn = sett.getId ? sett.getId.bind(sett) : null,
        textFn = sett.getText ? sett.getText.bind(sett) : null,
        classFn = function(d,i){
          var cl = "arc arc" + (i + 1);

          if (sett.getClass && typeof sett.getClass === "function") {
            cl += " " + sett.getClass.call(sett, d);
          }

          return cl;
        },
        getTextLength = function(obj, text) {
          var textObj = d3.select(obj),
            oldText = textObj.text(),
            value;

          textObj.text(text);
          value = obj.getSubStringLength(0, text.length);
          textObj.text(oldText);

          return value;
        },
        truncateText = function(d, i, selection) {
          var obj = selection[0],
            text = textFn.apply(this, arguments),
            angle, arcLength, elipsisLength, textLength, elipsisRatio, ratio;

          if (text.length < 1)
            return text;

          angle = (getEndAngle(d) - getStartAngle(d)) / (2 * Math.PI);
          arcLength = angle * 2 * Math.PI * y((d.y1 - d.y0) / 2 + d.y0);
          elipsisLength = getTextLength(obj, elipsis);
          textLength = getTextLength(obj, text);
          elipsisRatio = elipsisLength / arcLength,
          ratio = textLength / arcLength;

          if (elipsisRatio > 0.5 || arcLength <= 0) {
            text = "";
          } else if (ratio > 1) {
            text = text.substr(0, text.length * 1 / ratio) ;
            while (getTextLength(obj, text + elipsis) > arcLength){
              text = text.substr(0,text.length - 1);
            }
            text += elipsis;
          }

          return text;
        },
        partition = d3.partition()
          .padding(sett.padding),
        root = d3.hierarchy(filteredData)
          .sum(valueFn),
        arcs;

      if (dataLayer.empty()) {
        dataLayer = chartInner.append("g")
          .attr("class", "data")
          .attr("transform", "translate(" + innerWidth / 2 + "," + innerHeight / 2 + ")");
      }
      arcs = dataLayer
        .selectAll(".arc")
        .data(partition(root).descendants(), arcsIdFn);

      arcs
        .enter()
        .append("g")
        .attr("id", arcsIdFn)
        .attr("class", classFn)
        .each(function(d, index) {
          var parent = d3.select(this),
            arcId = function() {
              return svg.attr("id") + "arc" + index;
            },
            textObj, text;

          parent.append("path")
            .attr("id", arcId)
            .attr("d", arc);

          textObj = parent.append("text")
            .attr("dy", 15)
            .attr("dx", 5)
            .attr("aria-hidden", "true")
            .text(truncateText);

          text = textObj.text();

          textObj.text(null).append("textPath")
            .attr("xlink:href", function() {
              return "#" + arcId.apply(this, arguments);
            })
            .text(text);
        });

      arcs
        .attr("class", classFn)
        .each(function() {
          var parent = d3.select(this);

          parent.select("path")
            .attr("d", arc);

          parent.select("text textPath")
            .text(textFn);
        });
    },
    rtnObj, process;

  rtnObj = {
    settings: mergedSettings,
    svg: svg
  };

  svg
    .attr("viewBox", "0 0 " + outerWidth + " " + outerHeight)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img")
    .attr("aria-label", mergedSettings.altText);

  if (chartInner.empty()) {
    chartInner = svg.append("g")
      .attr("transform", "translate(" + mergedSettings.margin.left + "," + mergedSettings.margin.top + ")");
  }

  process = function() {
    draw.apply(rtnObj);
    if (mergedSettings.datatable === false) return;
    d3.stcExt.addIEShim(svg, outerHeight, outerWidth);
  };
  if (data === undefined) {
    d3.json(mergedSettings.url, function(error, json) {
      data = json;
      process();
    });
  } else {
    process();
  }

  return rtnObj;
};

})(jQuery.extend, jQuery);
