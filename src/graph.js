(function(extend) {
var defaults = {
  margin: {
    top: 2,
    right: 2,
    bottom: 2,
    left: 2
  },
  innerRadius: 60,
  padding: 0.0008,
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
    getTransition = function(transition) {
      var t = transition || d3.transition();
      return t.duration(1000);
    },
    draw = function() {
      var sett = this.settings,
        filteredData = (sett.filterData && typeof sett.filterData === "function") ?
          sett.filterData.call(sett, data) : data,
        outerRadius = Math.min(innerHeight, innerWidth) / 2,
        innerRadius = sett.innerRadius / 2,
        x = rtnObj.x = d3.scaleLinear()
          .range([0, 2 * Math.PI]),
        y = rtnObj.y = d3.scaleLinear()
          .range([innerRadius, outerRadius]),
        getStartAngle = function(d) {
          if (d.parent === null)
            return -Math.PI / 2;
          return Math.max(0, Math.min(2 * Math.PI, x(d.x0))) - (Math.PI / 2);
        },
        getEndAngle = function(d) {
          if (d.parent === null)
            return Math.PI * 2;
          return Math.max(0, Math.min(2 * Math.PI, x(d.x1))) - (Math.PI / 2);
        },
        getInnerRadius = function(d) {
          return y(d.y0);
        },
        getOuterRadius = function(d) {
          return y(d.y1);
        },
        arc = d3.arc()
          .startAngle(getStartAngle)
          .endAngle(getEndAngle)
          .innerRadius(getInnerRadius)
          .outerRadius(getOuterRadius)
          .padAngle(sett.padding !== 0 ? function(d) {
            var domain = x.domain(),
              zoom = domain[1] - domain[0] / 1,
              padding = typeof sett.padding === "function" ? sett.padding.call(sett, d) : sett.padding;
            return padding * zoom;
          } : null),
        valueFn = sett.getValue ? sett.getValue.bind(sett) : null,
        idFn = sett.getId ? sett.getId.bind(sett) : null,
        textFn = sett.getText ? sett.getText.bind(sett) : null,
        zoomCallback = sett.zoomCallback ? sett.zoomCallback.bind(sett) : null,
        textRedrawFn = function() {
          d3.select(this).select("textPath").text(truncateText);
        },
        classFn = function(d,i){
          var cl = "arc arc" + (i + 1);

          if (sett.getClass && typeof sett.getClass === "function") {
            cl += " " + sett.getClass.call(sett, d);
          }

          return cl;
        },
        domainInterpolator = function(d) {
          var dl = dataLayer.node(),
            oldDomain = x.domain().slice(),
            newDomain = [d.x0, d.x1].slice(),
            xd = d3.interpolateArray(oldDomain, newDomain);

          dl._domain = newDomain;

          return function(){
            return function(t) {
              x.domain(xd(t));
            };
          };
        },
        zoomArcInterpolator = function(d) {
          return function() {
            return arc(d);
          };
        },
        arcTween = function(d) {
          var oldD = this.parentNode._current,
            newD = {
              x0: d.x0,
              x1: d.x1,
              y0: d.y0,
              y1: d.y1
            },
            i;

          i = d3.interpolate(oldD, newD);

          this.parentNode._current = newD;

          return function(t) {
            var td = i(t);
            td.parent = d.parent;
            return arc(td);
          };

        },
        zoomFn = rtnObj.zoom = function(id) {
          var d = d3.select("#" + id).data()[0],
            textSelection = dataLayer.selectAll("textPath"),
            g;

          dataLayer
            .transition(getTransition())
            .tween("scale", domainInterpolator(d));

          textSelection.text(null);

          g = dataLayer.selectAll(".arc")
            .transition(getTransition())
            .on("end", textRedrawFn);

          g.select("path")
            .attrTween("d", zoomArcInterpolator);

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

              if (elipsisLength * 3 > arcLength)
                return null;

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
        partition = d3.partition(),
        root = partition(
          d3.hierarchy(filteredData)
            .sum(valueFn)
        ),
        getZoomDatum = function() {
          var children, c, d;
          if(sett.zoom){
            children = root.descendants();
            for (c = 0; c < children.length; c++) {
              d = children[c];
              if (idFn(d) === sett.zoom) {
                return d;
              }
            }
          }
        },
        arcs, domain, zoomD;

      if (dataLayer.empty()) {
        dataLayer = chartInner.append("g")
          .attr("class", "data")
          .attr("transform", "translate(" + innerWidth / 2 + "," + innerHeight / 2 + ")");
      } else {
        domain = dataLayer.node()._domain;

        if(domain)
          x.domain(domain);
      }

      zoomD = getZoomDatum();

      arcs = dataLayer
        .selectAll(".arc")
        .data(root.descendants(), idFn);

      arcs
        .enter()
        .call(function() {
          if (arcs.empty() && zoomD){
            x.domain([zoomD.x0, zoomD.x1]);
            dataLayer.node()._domain = x.domain();
          }
        })
        .append("g")
        .attr("id", idFn)
        .attr("class", classFn)
        .each(function(d, index) {
          var parent = d3.select(this),
            arcId = function() {
              return svg.attr("id") + "arc" + index;
            };

          this._current = d;

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
        .transition()
        .call(function() {
          if(!arcs.empty()) {
            dataLayer.transition(getTransition())
              .tween("scale", domainInterpolator(zoomD));
          }
        })
        .each(function() {
          var parent = getTransition(d3.select(this).transition());

          parent.select("text textPath")
            .text(null);

          parent
            .select("path")
            .attrTween("d", arcTween);

          parent.on("end", textRedrawFn);
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
