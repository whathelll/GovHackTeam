var _ = require('lodash'),
	d3 = require('d3');

var allByOccupation = require('../ad-hoc/sankey-all-by-occupation.json');
var allByAge = require('../ad-hoc/sankey-all-by-age.json');
var allBySex = require('../ad-hoc/sankey-all-by-sex.json');

var energy;
var config = {sa4: "", category: "occupation"};

var tooltip = d3.select("body")
	.append("div")
	.style("position", "absolute")
	.style("z-index", "10")
	.style("visibility", "hidden")
	.text("a simple tooltip");



var Engine = {
	setSA4: function(newVal, refresh) {
		config.sa4 = newVal;
		if(refresh) this.sankeySA();
	},
	setCategory: function(newVal, refresh) {
		config.category = newVal;
		if(refresh) this.sankeySA();
	},
	desc: 'Graph engine for GovHack app.',
	plot: function(data){
		// Plot logic here.
	},
	init: function(){
		// Sankey plugin
		d3.sankey = function() {
		  var sankey = {},
		      nodeWidth = 24,
		      nodePadding = 8,
		      size = [1, 1],
		      nodes = [],
		      links = [];

		  sankey.nodeWidth = function(_) {
		    if (!arguments.length) return nodeWidth;
		    nodeWidth = +_;
		    return sankey;
		  };

		  sankey.nodePadding = function(_) {
		    if (!arguments.length) return nodePadding;
		    nodePadding = +_;
		    return sankey;
		  };

		  sankey.nodes = function(_) {
		    if (!arguments.length) return nodes;
		    nodes = _;
		    return sankey;
		  };

		  sankey.links = function(_) {
		    if (!arguments.length) return links;
		    links = _;
		    return sankey;
		  };

		  sankey.size = function(_) {
		    if (!arguments.length) return size;
		    size = _;
		    return sankey;
		  };

		  sankey.layout = function(iterations) {
		    computeNodeLinks();
		    computeNodeValues();
		    computeNodeBreadths();
		    computeNodeDepths(iterations);
		    computeLinkDepths();
		    return sankey;
		  };

		  sankey.relayout = function() {
		    computeLinkDepths();
		    return sankey;
		  };

		  sankey.link = function() {
		    var curvature = .5;

		    function link(d) {
		      var x0 = d.source.x + d.source.dx,
		          x1 = d.target.x,
		          xi = d3.interpolateNumber(x0, x1),
		          x2 = xi(curvature),
		          x3 = xi(1 - curvature),
		          y0 = d.source.y + d.sy + d.dy / 2,
		          y1 = d.target.y + d.ty + d.dy / 2;
		      return "M" + x0 + "," + y0
		           + "C" + x2 + "," + y0
		           + " " + x3 + "," + y1
		           + " " + x1 + "," + y1;
		    }

		    link.curvature = function(_) {
		      if (!arguments.length) return curvature;
		      curvature = +_;
		      return link;
		    };

		    return link;
		  };

		  // Populate the sourceLinks and targetLinks for each node.
		  // Also, if the source and target are not objects, assume they are indices.
		  function computeNodeLinks() {
		    nodes.forEach(function(node) {
		      node.sourceLinks = [];
		      node.targetLinks = [];
		    });
		    links.forEach(function(link) {
		      var source = link.source,
		          target = link.target;
		      if (typeof source === "number") source = link.source = nodes[link.source];
		      if (typeof target === "number") target = link.target = nodes[link.target];
		      source.sourceLinks.push(link);
		      target.targetLinks.push(link);
		    });
		  }

		  // Compute the value (size) of each node by summing the associated links.
		  function computeNodeValues() {
		    nodes.forEach(function(node) {
		      node.value = Math.max(
		        d3.sum(node.sourceLinks, value),
		        d3.sum(node.targetLinks, value)
		      );
		    });
		  }

		  // Iteratively assign the breadth (x-position) for each node.
		  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
		  // nodes with no incoming links are assigned breadth zero, while
		  // nodes with no outgoing links are assigned the maximum breadth.
		  function computeNodeBreadths() {
		    var remainingNodes = nodes,
		        nextNodes,
		        x = 0;

		    while (remainingNodes.length) {
		      nextNodes = [];
		      remainingNodes.forEach(function(node) {
		        node.x = x;
		        node.dx = nodeWidth;
		        node.sourceLinks.forEach(function(link) {
		          nextNodes.push(link.target);
		        });
		      });
		      remainingNodes = nextNodes;
		      ++x;
		    }

		    //
		    moveSinksRight(x);
		    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
		  }

		  function moveSourcesRight() {
		    nodes.forEach(function(node) {
		      if (!node.targetLinks.length) {
		        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
		      }
		    });
		  }

		  function moveSinksRight(x) {
		    nodes.forEach(function(node) {
		      if (!node.sourceLinks.length) {
		        node.x = x - 1;
		      }
		    });
		  }

		  function scaleNodeBreadths(kx) {
		    nodes.forEach(function(node) {
		      node.x *= kx;
		    });
		  }

		  function computeNodeDepths(iterations) {
		    var nodesByBreadth = d3.nest()
		        .key(function(d) { return d.x; })
		        .sortKeys(d3.ascending)
		        .entries(nodes)
		        .map(function(d) { return d.values; });

		    //
		    initializeNodeDepth();
		    resolveCollisions();
		    for (var alpha = 1; iterations > 0; --iterations) {
		      relaxRightToLeft(alpha *= .99);
		      resolveCollisions();
		      relaxLeftToRight(alpha);
		      resolveCollisions();
		    }

		    function initializeNodeDepth() {
		      var ky = d3.min(nodesByBreadth, function(nodes) {
		        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
		      });

		      nodesByBreadth.forEach(function(nodes) {
		        nodes.forEach(function(node, i) {
		          node.y = i;
		          node.dy = node.value * ky;
		        });
		      });

		      links.forEach(function(link) {
		        link.dy = link.value * ky;
		      });
		    }

		    function relaxLeftToRight(alpha) {
		      nodesByBreadth.forEach(function(nodes, breadth) {
		        nodes.forEach(function(node) {
		          if (node.targetLinks.length) {
		            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
		            node.y += (y - center(node)) * alpha;
		          }
		        });
		      });

		      function weightedSource(link) {
		        return center(link.source) * link.value;
		      }
		    }

		    function relaxRightToLeft(alpha) {
		      nodesByBreadth.slice().reverse().forEach(function(nodes) {
		        nodes.forEach(function(node) {
		          if (node.sourceLinks.length) {
		            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
		            node.y += (y - center(node)) * alpha;
		          }
		        });
		      });

		      function weightedTarget(link) {
		        return center(link.target) * link.value;
		      }
		    }

		    function resolveCollisions() {
		      nodesByBreadth.forEach(function(nodes) {
		        var node,
		            dy,
		            y0 = 0,
		            n = nodes.length,
		            i;

		        // Push any overlapping nodes down.
		        nodes.sort(ascendingDepth);
		        for (i = 0; i < n; ++i) {
		          node = nodes[i];
		          dy = y0 - node.y;
		          if (dy > 0) node.y += dy;
		          y0 = node.y + node.dy + nodePadding;
		        }

		        // If the bottommost node goes outside the bounds, push it back up.
		        dy = y0 - nodePadding - size[1];
		        if (dy > 0) {
		          y0 = node.y -= dy;

		          // Push any overlapping nodes back up.
		          for (i = n - 2; i >= 0; --i) {
		            node = nodes[i];
		            dy = node.y + node.dy + nodePadding - y0;
		            if (dy > 0) node.y -= dy;
		            y0 = node.y;
		          }
		        }
		      });
		    }

		    function ascendingDepth(a, b) {
		      return a.y - b.y;
		    }
		  }

		  function computeLinkDepths() {
		    nodes.forEach(function(node) {
		      node.sourceLinks.sort(ascendingTargetDepth);
		      node.targetLinks.sort(ascendingSourceDepth);
		    });
		    nodes.forEach(function(node) {
		      var sy = 0, ty = 0;
		      node.sourceLinks.forEach(function(link) {
		        link.sy = sy;
		        sy += link.dy;
		      });
		      node.targetLinks.forEach(function(link) {
		        link.ty = ty;
		        ty += link.dy;
		      });
		    });

		    function ascendingSourceDepth(a, b) {
		      return a.source.y - b.source.y;
		    }

		    function ascendingTargetDepth(a, b) {
		      return a.target.y - b.target.y;
		    }
		  }

		  function center(node) {
		    return node.y + node.dy / 2;
		  }

		  function value(link) {
		    return link.value;
		  }

		  return sankey;
		};
	},
	sankeySA: function(conf){
		conf = config;
		console.log('calling sankeySA with: ' + JSON.stringify(conf));

		if(conf.sa4=="" || !conf.sa4) {
			console.log('using all data');
			if(conf.category=="occupation") energy = allByOccupation;
			if(conf.category=="age") energy = allByAge;
			if(conf.category=="sex") energy = allBySex;
		} else {
			energy = require('./get-sankey-data-by-sa')(conf.sa4, conf.category);
		}

		this.plotSankey();
	},
	sankeyDemo: function(){
		energy = require('../ad-hoc/sankey-all-by-occupation.json');
		this.plotSankey();
	},
	plotSankey: function(){
		pW = 850;
		pH = 600;

		d3.select("#chart")
		.selectAll('svg')
		.remove();

		var margin = {top: 1, right: 1, bottom: 6, left: 1},
		    width = pW - margin.left - margin.right,
		    height = pH - margin.top - margin.bottom;

		var formatNumber = d3.format(",.0f"),
		    format = function(d) { return formatNumber(d) + ""; },
		    color = d3.scale.category20();

		var svg = d3.select("#chart").append("svg")
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		  	.append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var sankey = d3.sankey()
			    .nodeWidth(15)
			    .nodePadding(10)
			    .size([width, height]);

		var energyCpy = _.cloneDeep(energy);
		sankeyfy(energyCpy);

		// $('#btn-update-1').on('click', function(){
		// 	var energyCpy = _.cloneDeep(energy);
		//   	sankeyfy(energyCpy, true);
		//   });

		function sankeyfy(data, isUpdate){
			var path = sankey.link();

			  sankey
			      .nodes(data.nodes)
			      .links(data.links)
			      .layout();

			      if(isUpdate){
			      	var link = d3.selectAll(".link")
					      .data(data.links).attr("d", path);

					  // var node = d3.selectAll(".node")
					  //     .data(data.nodes);


					d3.selectAll(".node").attr("transform", function(d) {
					  return "translate(" + d.x + "," + d.y + ")"; });

					d3.selectAll("rect")
						.attr("height", function(d) { return d.dy; });

				      function dragmove(d) {
					    d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
					    sankey.relayout();
					    link.attr("d", path);
					  }

			      }else{
			      	var link = svg.append("g").selectAll(".link")
				      .data(data.links)
				    	.enter().append("path")
				      .attr("class", "link")
				      .attr("d", path)
				      .style("stroke-width", function(d) { return Math.max(1, d.dy); })
				      .sort(function(a, b) { return b.dy - a.dy; })
							.on("mouseover", function(d){return tooltip
																									.style("visibility", "visible")
																									.text(function() { console.log(d); return d.source.name + " → " + d.target.name + "\n" + format(d.value); });})
							.on("mousemove", function(){return tooltip.style("top", (event.pageY-10)+"px").style("left",(event.pageX+10)+"px");})
							.on("mouseout", function(){return tooltip.style("visibility", "hidden");});

				  // link.append("title")
				  //     .text(function(d) { return d.source.name + " → " + d.target.name + "\n" + format(d.value); });

				  var node = svg.append("g").selectAll(".node")
				      .data(data.nodes)
				    .enter().append("g")
				      .attr("data-targets", getToLinks)
				      .attr("data-sources", getFromLinks)
				      .attr("class", "node")
				      .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
				    .call(d3.behavior.drag()
				      .origin(function(d) { return d; })
				      .on("dragstart", function() { this.parentNode.appendChild(this); })
				      .on("drag", dragmove));

				  node.append("rect")
				      .attr("height", function(d) { return d.dy; })
				      .attr("width", sankey.nodeWidth())
				      .style("fill", function(d) { return d.color = color(d.name.replace(/ .*/, "")); })
				      .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
				    .append("title")
				      .text(function(d) { return d.name + "\n" + format(d.value); });

				  node.append("text")
				      .attr("x", -6)
				      .attr("y", function(d) { return d.dy / 2; })
				      .attr("dy", ".35em")
				      .attr("text-anchor", "end")
				      .attr("transform", null)
				      .text(function(d) { return d.name; })
				    .filter(function(d) { return d.x < width / 2; })
				      .attr("x", 6 + sankey.nodeWidth())
				      .attr("text-anchor", "start");
			      }

			  function dragmove(d) {
			    d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
			    sankey.relayout();
			    link.attr("d", path);
			  }
		}



		  function getToLinks(d) {
		  	var attrVal = "";
		  	for(var i = 0; i < d.sourceLinks.length; i++){
		  		attrVal += d.sourceLinks[i].target.name + '=' + format(d.sourceLinks[i].value);
		  		if(i !== d.sourceLinks.length - 1){
		  			attrVal += '*';
		  		}
		  	}
		  	return attrVal;
		  }

		  function getFromLinks(d) {
		  	var attrVal = "";
		  	for(var i = 0; i < d.targetLinks.length; i++){
		  		attrVal += d.targetLinks[i].source.name + '=' + format(d.targetLinks[i].value);
		  		if(i !== d.targetLinks.length - 1){
		  			attrVal += '*';
		  		}
		  	}
		  	return attrVal;
		  }
	}
};

module.exports = Engine;
