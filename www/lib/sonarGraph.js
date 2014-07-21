(function (exports) {

    var sonarGraph = function (options) {

        var xDomain = [-180, 180];
        var xTickValues = _.range(-180, 181, 45);
        var xTickFormat = function (d) { return d; };

        var d3MapDetections = {};
        var detectionKeys = {x: 'degree', y: 'date'};
        var renderedDetections = {};
        var graph;
        var mainClipPath;
        var gMain;
        var containerElementSize;

        var yAxisFormat = d3.time.format("%H:%M:%S");
        var xAxisLabel = "Degree º";

        var xAxisElement;
        var yAxisElement;

        var yAxisScale = d3.time.scale();
        var xComponent;

        var initialTime;

        var config = {
            containerElement: null,
            yTicks: 5,
            yDomainDensity: 1,
            detectionPointRadii: {rx: 0, ry: 0},
            yAxisLabel: "Time",
            showXAxis: true,
            margin: {top: 25, left: 100, bottom: 5, right: 50},
            detectionSelect: function () {}
        };

        var detectionExpireTime =  1 * 60 * 1000; // 1 minute

        init();

        function init() {
            _.each(options, function (value, key) {
                if (value !== undefined) {
                    config[key] = value;
                }
            });

            addSvgElement();
            elementSize(config.elementSize);
            configureScale();

            addClipPath();
            addGxAxis();
            addGyAxis();
            addGroupContainer();
        }

        /**
         * Add svg element and apply margin values.
         */
        function addSvgElement() {
            var svg = d3.select(config.containerElement)
                .append('svg')
                .attr('class', 'graph g-wrapper');

            // https://bugzilla.mozilla.org/show_bug.cgi?id=779368
            // http://thatemil.com/blog/2014/04/06/intrinsic-sizing-of-svg-in-responsive-web-design/
            svg.style({width: '100%', height: '100%'});

            graph = svg
                .append('g')
                .attr('transform', 'translate(' + config.margin.left + ',' + config.margin.top + ')');
        }

        /**
         * Calculate sonar size without margin values.
         */
        function elementSize(dimension) {
            containerElementSize = {
                width: dimension.width - (config.margin.left + config.margin.right),
                height: dimension.height - (config.margin.top + config.margin.bottom)
            };
        }

        /**
         * Configure d3 lib scale for axes
         */
        function configureScale() {
            xComponent = d3.scale.linear()
                .domain(xDomain)
                .range([0, containerElementSize.width]);

            yAxisScale.range([containerElementSize.height, 0]);
        }

        /**
         * Add clip path for sonar graph and reusable detection point.
         */
        function addClipPath() {

            mainClipPath = graph
                .append('defs')
                .append('clipPath')
                .attr('id', 'clipPath_' + config.containerElement.id)
                .append('rect')
                .attr('width', containerElementSize.width)
                .attr('height', containerElementSize.height);

            graph
                .append('defs')
                .append('ellipse')
                .attr('cx', 2.5)
                .attr('cy', 4)
                .attr('rx', config.detectionPointRadii.rx)
                .attr('ry', config.detectionPointRadii.ry)
                .attr('id', 'pathMarker_' + config.containerElement.id)
                .style({'fill': 'rgb(170, 206, 0)'});
        }

        /**
         * Add X axis to the graph
         */
        function addGxAxis() {
            // d3 axis component
            xComponent.axis = d3.svg.axis()
                .scale(xComponent)
                .tickValues(xTickValues)
                .tickFormat(xTickFormat)
                .orient("top");

            // add axis element and apply axis component
            xAxisElement = graph.append('g')
                .attr('class', 'x axis')
                .attr('transform', 'translate(0, 0)')
                .style('opacity', config.showXAxis ? 1 : 0)
                .call(xComponent.axis);

            // axis label
            xAxisElement.append('text')
                .classed('axis-unit', true)
                .attr('transform', 'translate(' + containerElementSize.width + ',0)')
                .attr('y', 0)
                .attr('dy', '1.71em')
                .style('text-anchor', 'end')
                .text(xAxisLabel);
        }

        /**
         * Add Y axis to the graph
         */
        function addGyAxis() {
            // d3 axis component
            yAxisScale.axis = d3.svg.axis()
                .scale(yAxisScale)
                .ticks(config.yTicks)
                .tickFormat(function (d) {
                    return yAxisFormat(d);
                })
                .orient('left');

            // add axis element and apply axis component
            yAxisElement = graph.append('g')
                .attr('class', 'y axis')
                .attr('transform', 'translate(0,0)')
                .call(yAxisScale.axis);

            // axis label
            yAxisElement
                .append('text')
                .classed('axis-unit', true)
                .attr('transform', 'translate(0,' + containerElementSize.height + ') rotate(-90)')
                .attr('y', 6)
                .attr('dy', '.71em')
                .attr('dx', '2.71em')
                .style('text-anchor', 'end')
                .text(config.yAxisLabel);
        }

        /**
         * Reconfigure Y-axis domain.
         *
         * @param {Object} detections
         */
        function changeYAxisDomain(detections) {
            var currentDate = _.first(detections).date;
            var firstRunTime;

            if (currentDate) {
                firstRunTime = currentDate.getTime();

                yAxisScale.domain([firstRunTime - config.yDomainDensity * 60 * 1000, firstRunTime]);
                yAxisElement
                    .call(yAxisScale.axis);
            }
        }

        /**
         * Append datapoint element to group.
         *
         * @param {Object} group
         * @param {Object} detection
         * @param {String} name
         * @returns {Object}
         */
        function appendDetectionPointToGroup(group, detection, name) {
            return group
                .append('use')
                .attr("xlink:href", '#pathMarker_' + config.containerElement.id)
                .attr('x', xComponent(xTickFormat(detection[detectionKeys.x])))
                .attr('y', -yAxisScale(initialTime))
                .attr('class', name)
        }

        /**
         * Render added detections on graph.
         */
        function render() {
            _.each(d3MapDetections, function (detection, name) {
                if (!renderedDetections[name]) {
                    // new detection
                    var data = [];
                    // add group element
                    var group = gMain.append('g')
                        .attr('class', 'line ' + name);
                    // bind click handler
                    group.on('click', function () {
                        var detectionName = '';
                        if(event.target.getAttribute) {
                            detectionName = event.target.getAttribute('class');
                        } else if (event.target.correspondingUseElement) {
                            detectionName = event.target.correspondingUseElement.getAttribute('class');
                        } else {
                            alert('Can\'t get class attribute of the target');
                        }
                        config.detectionSelect(detectionName);
                    });

                    // append new point element based on detection
                    detection.pointElement = appendDetectionPointToGroup(group, detection, name);
                    // there is no element, need to create it
                    data.push(detection);

                    // add detection data to rendered collection
                    renderedDetections[name] = {
                        data: data,
                        group: group
                    };

                } else {
                    // move group element
                    renderedDetections[name].group
                        .attr('transform', 'translate(0, ' + yAxisScale(initialTime) +')');

                    if (!renderedDetections[name].isExpired) {
                        // append new point element based on detection
                        detection.pointElement = appendDetectionPointToGroup(renderedDetections[name].group, detection, name);
                        // add detection to rendered collection
                        renderedDetections[name].data.push(detection);

                        if (yAxisScale.domain()[0].getTime() >
                            (_.first(renderedDetections[name].data).date.getTime() + detectionExpireTime)) {
                            // time of detection point is higher then acceptable time

                            // remove datapoint from collection
                            var expiredDetection = renderedDetections[name].data.shift();
                            // remve datapoint element
                            expiredDetection.pointElement.remove();
                        }
                    }
                }
            });
        }

        function addGroupContainer() {
            gMain = graph.append("g")
                .attr('class', 'gMain')
                .attr('clip-path', 'url(#clipPath_'+config.containerElement.id+')');
        }

        /**
         * Add new detections to graph.
         *
         * @param {Object} detections
         */
        function addDetection(detections){
            // create list of path names from detections
            _.each(detections, function (detection) {
                // exclude a detection path name from the list
                addDatapoint(d3MapDetections, detection);
            });

            findExpiredDetections(detections);

            render();
            changeYAxisDomain(detections);
        }

        /**
         * Find expired detections by comparing new detections list and existed.
         *
         * @param {Object} detections
         */
        function findExpiredDetections(detections) {
            var existedDetections = _.keys(renderedDetections);
            var newDetections = _.pluck(detections, 'name');
            var expiredDetections = [];

            _.each(existedDetections, function (detection) {
                if (!_.contains(newDetections, detection)) {
                    expiredDetections.push(detection);
                    renderedDetections[detection].isExpired = true;
                }
            });

            if (expiredDetections.length) {
                // if list still contains detections - just move the corresponded path
                removeExpiredDetection(d3MapDetections, expiredDetections);
            }
        }

        /**
         * Remove expired (out of clip path) element from DOM and datapoint respectively.
         *
         * @param {Object} dataset
         * @param {Object} datapoints
         */
        function removeExpiredDetection(dataset, datapoints) {
            _.each(datapoints, function (datapoint) {
                // extract first datapoint
            var expiredDetection = renderedDetections[datapoint].data.shift();
                // and remove it
                expiredDetection.pointElement.remove();

                if (!renderedDetections[datapoint].data.length) {
                    // if collection is empty
                    // remove empty collection
                    delete renderedDetections[datapoint];
                    // remove detection collection respectively
                    delete dataset[datapoint];
                    // remove group wrapper element
                    $('#' + config.containerElement.id + ' .' + datapoint).remove();
                }
            });
        }

        /**
         * Add datapoint to the dataset.
         *
         * @param {Object} dataset
         * @param {Object} row
         */
        function addDatapoint(dataset, row) {
            if (row.name === 'Time' || row.name === 'S1' || row.name === 'S2') {
                // skip useless paths
                return;
            }

            dataset[row.name] = {
                date: row.date,
                degree: row.degree,
                strength: row.strength ? row.strength : null
            };

            if (!initialTime) {
                initialTime = row.date;
            }
        }

        /**
         * Update graph height value and reconfigure Y-axis with a new range.
         *
         * @param {Object} dimension
         */
        function changeGraphHeight(dimension) {
            elementSize(dimension);
            yAxisScale.range([containerElementSize.height, 0]);
        }

        /**
         * Return API functions.
         */
        return {
            changeYAxisDomain: changeYAxisDomain,
            addDetection: addDetection,
            changeGraphHeight: changeGraphHeight
        };
    };

    exports.sonarGraph = sonarGraph;

})(window);
