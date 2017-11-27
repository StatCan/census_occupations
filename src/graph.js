(function(extend) {
var defaults = {
  margin: {
    top: 2,
    right: 2,
    bottom: 2,
    left: 2
  },
  innerRadius: 20,
  padding: 0,
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
    arcTextPadding = 5,
    getTransition = function() {
      return d3.transition()
        .duration(1000);
    },
    draw = function() {
      var sett = this.settings,
        filteredData = (sett.filterData && typeof sett.filterData === "function") ?
          sett.filterData.call(sett, data) : data,
        outerRadius = Math.min(innerHeight, innerWidth) / 2,
        innerRadius = sett.innerRadius,
        x = rtnObj.x = d3.scaleLinear()
          .range([0, 2 * Math.PI]),
        y = rtnObj.y = d3.scaleSqrt()
          .range([innerRadius, outerRadius]),
        getStartAngle = function(d) {
          return Math.max(0, Math.min(2 * Math.PI, x(d.x0)));
        },
        getEndAngle = function(d) {
          return Math.max(0, Math.min(2 * Math.PI, x(d.x1)));
        },
        arc = d3.arc()
          .startAngle(getStartAngle)
          .endAngle(getEndAngle)
          .innerRadius(function(d) { return y(d.y0); })
          .outerRadius(function(d) { return y(d.y1); }),
        valueFn = sett.getValue ? sett.getValue.bind(sett) : null,
        idFn = sett.getId ? sett.getId.bind(sett) : null,
        textFn = sett.getText ? sett.getText.bind(sett) : null,
        zoomCallback = sett.zoomCallback ? sett.zoomCallback.bind(sett) : null,
        classFn = function(d,i){
          var cl = "arc arc" + (i + 1);

          if (sett.getClass && typeof sett.getClass === "function") {
            cl += " " + sett.getClass.call(sett, d);
          }

          return cl;
        },
        arcTweens = function(d) {
          var xd = d3.interpolate(x.domain(), [d.x0, d.x1]);

          return {
            domain: function() {
              return function(t) {
                x.domain(xd(t));
              };
            },
            arcs: function(d) {
              return function() {
                return arc(d);
              };
            }
          };
        },
        zoomFn = rtnObj.zoom = function(id) {
          var d = d3.select("#" + id).data()[0],
            textSelection = dataLayer.selectAll("textPath"),
            t = getTransition(),
            interpolaters = arcTweens(d),
            g;

          dataLayer
            .transition(t)
            .tween("scale", interpolaters.domain);

          textSelection.text(null);

          g = dataLayer.selectAll(".arc")
            .transition(t)
            .on("end", function() {
              d3.select(this).select("textPath").text(truncateText);
            });

          g.select("path")
            .attrTween("d", interpolaters.arcs);


          if (zoomCallback) {
            zoomCallback(id);
          }
        },

        truncateText = function(d, i, selection) {
          var obj = selection[0],
            textObj = d3.select(obj.parentNode).append("tspan"),
            text = textFn.apply(this, arguments),
            getText = function() {
              var angle, radius, arcLength, elipsisLength, textLength, pos, ratio;

              angle = (getEndAngle(d) - getStartAngle(d)) / (2 * Math.PI);
              radius = y((d.y1 - d.y0) * 2 / 3 + d.y0);
              arcLength = (angle * 2 * Math.PI * radius) - (arcTextPadding * 2);

              if (text.length < 1 || arcLength <= 0)
                return null;


              textObj.text(elipsis);
              elipsisLength = textObj.node().getComputedTextLength();
              textObj.text(text);
              textLength = textObj.node().getComputedTextLength();

              if (textLength < arcLength)
                return text;

              if (elipsisLength > arcLength)
                return null;

              if (elipsisLength < arcLength && elipsisLength * 3 > arcLength)
                return elipsis;

              ratio = textLength / arcLength;
              pos = Math.ceil(text.length * 1 / ratio);
              while (textObj.node().getSubStringLength(0, pos) + elipsisLength > arcLength){
                pos--;
              }
              return text.substr(0, pos) + elipsis;
            },
            rtn = getText();

          textObj.remove();

          return rtn;
        },
        partition = d3.partition()
          .padding(sett.padding),
        root = partition(
          d3.hierarchy(filteredData)
            .sum(valueFn)
          ),
        arcs, children, c, d;

      if (sett.zoom) {
        children = root.descendants();
        for (c = 0; c < children.length; c++) {
          d = children[c];
          if (idFn(d) === sett.zoom) {
            x.domain([d.x0, d.x1]);
            break;
          }
        }
      }

      if (dataLayer.empty()) {
        dataLayer = chartInner.append("g")
          .attr("class", "data")
          .attr("transform", "translate(" + innerWidth / 2 + "," + innerHeight / 2 + ")");
      }
      arcs = dataLayer
        .selectAll(".arc")
        .data(root.descendants(), idFn);

      arcs
        .enter()
        .append("g")
        .attr("id", idFn)
        .attr("class", classFn)
        .each(function(d, index) {
          var parent = d3.select(this),
            arcId = function() {
              return svg.attr("id") + "arc" + index;
            };

          parent.append("path")
            .attr("id", arcId)
            .attr("d", arc)
            .on("click", function() {
              zoomFn(this.parentNode.id);
            });

          parent.append("text")
            .attr("dy", 15)
            .attr("dx", arcTextPadding)
            .attr("aria-hidden", "true")
            .append("textPath")
              .attr("xlink:href", function() {
                return "#" + arcId.apply(this, arguments);
              })
              .text(truncateText);
        });

      arcs
        .attr("class", classFn)
        .each(function() {
          var parent = d3.select(this);

          parent.select("path")
            .attr("d", arc);

          parent.select("text textPath")
            .text(truncateText);
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
