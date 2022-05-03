const svgns = "http://www.w3.org/2000/svg";

/**
 * A class for drawing lines with SVG.
 */
class SvgConnector {
	
	/**
	 * Create an SVG element drawing a line between the specified start and end points, with optional markers at each end.
	 * The SVG returned will be absolutely positioned and should be appended to the document as needed by the caller.
	 *
	 * @static
	 * @param {object} settings
	 * @param {object} settings.start - The x and y coordinates of the start point
	 * @param {number} settings.start.x
	 * @param {number} settings.start.y
	 * @param {object} settings.end - The x and y coordinates of the end point
	 * @param {number} settings.end.x
	 * @param {number} settings.end.y
	 * @param {string} settings.stroke - The stroke width in px of the line
	 * @param {string} settings.colour - The colour of the line. Must be a valid hex colour.
	 * @param {array.<string>} [settings.markers] - An array of two string values indicating the start and end markers respectively.
	 * 		Valid values are "circle", "square" and "dots" (the last can only be used for end).
	 * @param {string} [settings.dashes] - A dasharray string for the SVG line. If omitted, a solid line will be used.
	 * 		Must be a valid SVG dasharray (@see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray})
	 * @param {String} [settings.title] - If included, a title element will be included on the line with the given text.
	 * @return {object}
	 */
	static draw({
		start,
		end,
		stroke,
		colour,
		markers = [],
		dashes = "",
		title = ""
	} = {}) {
		const offset = stroke*2;	//This offset makes the canvas larger, allowing for wider end markers
		
		const xDisplacement = end.x - start.x;
		const yDisplacement = end.y - start.y;
		
		//Default positioning, if we are drawing from origin.
		const coords = {
			x1: offset,
			y1: offset,
			x2: xDisplacement + offset,
			y2: yDisplacement + offset
		}
		
		//If X or Y end coords are lower than start, then we need to offset as line is not from origin
		if (end.x < start.x) {
			coords.x1 += Math.abs(xDisplacement);
			coords.x2 += Math.abs(xDisplacement);
		}
		
		if (end.y < start.y) {
			coords.y1 += Math.abs(yDisplacement);
			coords.y2 += Math.abs(yDisplacement);
		}
		
		//Position SVG to account for line thickness overflow from origin
		//E.g. a horizontal line from (0,0) with a thickness of 10 displays from -5 to + 5
		const xpos = Math.min(start.x,end.x) - offset;
		const ypos = Math.min(start.y,end.y) - offset;
		
		let svg = document.createElementNS(svgns, "svg");
		svg.setAttribute("width", Math.abs(xDisplacement) + offset*2);
		svg.setAttribute("height", Math.abs(yDisplacement) + offset*2);
		svg.setAttribute("style", "position: absolute; left: " + xpos + "px; top: " + ypos + "px");

		const line = this.drawLine(coords, colour, stroke, dashes, title);
		//debugging
		line.setAttribute("data-coords", `[ ${start.x}, ${start.y} ], [ ${end.x}, ${end.y} ]`);
		svg.append(line);
		
		svg = this._addMarker(svg, markers[0], "start", coords, stroke, colour);
		svg = this._addMarker(svg, markers[1], "end", coords, stroke, colour);

		return svg;
	}
	
	/**
	 * Add a marker to the svg provided at the end specified.
	 * @param {object} svg
	 * @param {string} type
	 * @param {string} pos
	 * @param {object} coords
	 * @param {number} stroke
	 * @param {string} colour
	 * @return {object|null}
	 */
	static _addMarker(svg, type, pos, coords, stroke, colour) {
		if (type == "circle") svg.append(this._drawCircleMarker(pos, coords, stroke, colour));
		if (type == "square") svg.append(this._drawSquareMarker(pos, coords, stroke, colour));
		if (type == "dots" && pos == "end") {
			svg.setAttribute("width", parseInt(svg.getAttribute("width")) + stroke*2);
			svg.append(this._drawDotsEnd(coords, stroke, colour));
		}
		return svg;
	}
	
	/**
	 * Draw a square marker at the given position of the line represented by the given coords.
	 * @param {string} pos - Either "start" or "end"
	 * @param {object} coords - the four coords of the line
	 * @param {number} stroke - the stroke width
	 * @param {string} colour - the drawing colour
	 * @return {object}
	 */
	static _drawSquareMarker(pos, coords, stroke, colour) {
		let [x, y] = [coords.x1 - stroke, coords.y1 - stroke];
		if (pos = "end") [x, y] = [coords.x2 - stroke, coords.y2 - stroke];
		return this.drawSquare(x, y, stroke * 2.5, colour);
	}
	
	/**
	 * Draw a circle marker at the given position of the line represented by the given coords.
	 * @param {string} pos - Either "start" or "end"
	 * @param {object} coords - the four coords of the line
	 * @param {number} stroke - the stroke width
	 * @param {string} colour - the drawing colour
	 * @return {object}
	 */
	static _drawCircleMarker(pos, coords, stroke, colour) {
		let [x, y] = [coords.x1, coords.y1];
		if (pos = "end") [x, y] = [coords.x2, coords.y2];
		return this.drawCircle(x, y, stroke, colour);
	}
	
	/**
	 * Draw dots marker at the end of the line.
	 * (Note - requires full line coords, because marker has direction)
	 * @param {object} coords - the 4 coords of the line being marked
	 * @param {number} stroke - the stroke width of the line
	 * @param {string} colour - the drawing colour.
	 * @return {object}
	 */
	static _drawDotsEnd(coords, stroke, colour) {
		
		let x2 = coords.x2;
		if (coords.x2 < coords.x1) {
			x2 = coords.x2 - stroke*5;
		}
		if (coords.x2 > coords.x1) {
			x2 = coords.x2 + stroke*5;
		}
		
		let y2 = coords.y2;
		if (coords.y2 < coords.y1) {
			y2 = coords.y2 - stroke*2;
		}
		if (coords.y2 > coords.y1) {
			y2 = coords.y2 + stroke*2;
		}
		
		const dotCoords = {
			x1: coords.x2,
			y1: coords.y2,
			x2: x2,
			y2: y2
		}
		return this.drawLine(dotCoords, colour, stroke, `0 ${stroke} ${stroke} ${stroke} ${stroke}`);
	}
	
	/**
	 * Returns an SVG line, which can be appended to an SVG element.
	 * @param {object} coords - the x and y coordinates of the start and end points of the line
	 * @param {number} coords.x1
	 * @param {number} coords.y1
	 * @param {number} coords.x2
	 * @param {number} coords.y2
	 * @param {string} colour - The colour of the line. Must be a valid hex colour.
	 * @param {number} width - The width in px of the line
	 * @param {string} [dashes] - The dasharray pattern of the line. If omitted, it will be solid.
	 * 		Must be a valid SVG dasharray (@see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray})
	 * @param {String} [title] - If included, a title element will be included with the given text.
	 * @return {object}
	 */
	static drawLine(coords, colour, width, dashes = "", title = "") {
		const line = document.createElementNS(svgns, "line");
		line.setAttribute("x1", coords.x1);
		line.setAttribute("y1", coords.y1);
		line.setAttribute("x2", coords.x2);
		line.setAttribute("y2", coords.y2);
		line.setAttribute("stroke", colour);
		line.setAttribute("stroke-width", width);
		line.setAttribute("stroke-dasharray",dashes);
		
		if(title) {
			line.append(this._createTitle(title));
		}
		return line;
	}
	
	/**
	 * Return an SVG circle, which can be appended to an SVG element.
	 * @param {number} cx - The X coordinate of the circle centre
	 * @param {number} cy - The Y coordinate of the circle centre
	 * @param {number} r - The radius in px of the circle
	 * @param {string} colour - The colour of the circle. Must be a valid hex colour.
	 * @param {String} [title] - If included, a title element will be included with the given text.
	 * @return {object}
	 */
	static drawCircle(cx, cy, r, colour, title = "") {
		const circle = document.createElementNS(svgns, "circle");
		circle.setAttribute("cx", cx);
		circle.setAttribute("cy", cy);
		circle.setAttribute("r", r);
		circle.setAttribute("fill", colour);
		
		if(title) {
			circle.append(this._createTitle(title));
		}
		
		return circle;
	}
	
	/**
	 * Returns an SVG square, which can be appended to an SVG element.
	 * @param {number} x - The X coordinate
	 * @param {number} y - The y coordinate
	 * @param {number} w - The width of the square
	 * @param {string} colour - The colour of the square. Must be a valid hex colour
	 * @param {String} [title] - If included, a title element will be included with the given text.
	 * @return {object}
	 */
	static drawSquare(x, y, w, colour, title = "") {
		const square = document.createElementNS(svgns, "rect");
		square.setAttribute("x", x);
		square.setAttribute("y", y);
		square.setAttribute("width", w);
		square.setAttribute("height", w);
		square.setAttribute("fill", colour);
		
		if(title) {
			square.append(this._createTitle(title));
		}
		
		return square;
	}
	
	/**
	 * Create a title element with the given title
	 * @param {string} title
	 * @return {object}
	 */
	static _createTitle(title) {
		
		const t = document.createElementNS(svgns, "title");
		t.append(document.createTextNode(title));
		t.dataset.title = title;
		return t;
	}
}

export default SvgConnector
