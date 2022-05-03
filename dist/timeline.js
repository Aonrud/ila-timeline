/*! Timeline
 *Copyright (C) 2021 Aonghus Storey
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Timeline = factory());
})(this, (function () { 'use strict';

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
			};
			
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
			if ("end") [x, y] = [coords.x2 - stroke, coords.y2 - stroke];
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
			if ("end") [x, y] = [coords.x2, coords.y2];
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
			};
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

	/**
	 * Calculates an available position for diagram entries which have not had their row (Y-axis position) set manually.
	 * This is fairly rudimentary - a row with sufficient empty space for each entry (and any it joins directly with) will be calculated.
	 * If the entry splits from, merges with, or forks into other entries, the nearest row to those entries will be sought.
	 * This is most effectively used in a hybrid form, using some manual positioning, allowing simpler cases to be positioned automatically.
	 */
	class DiagramPositioner {
		
		/**
		 * @param {number} years - Length of the timeline in years.
		 * @param {number} [yearStart=1900] - The first year of the timeline.
		 * @param {number} [rows] - The number of rows currently in the timeline (used for mixed manual and auto positioning).
		 */
		constructor(years, yearStart = 1900, rows = 1) {
			this._years = years;
			this._yearStart = yearStart;
			this._grid = Array.from(Array(rows+1), () => new Array(years).fill(false));
		}
		
		/**
		 * Apply blocks that are manually specified.
		 * Note: Blocks targeted at specific elements can also be set. These are handled in setEntryRow() when positioning the targeted entry.
		 * @public
		 * @param {Nodelist} blocks
		 */
		applyBlocks(blocks) {
			for (const block of blocks) {
				if (block.dataset.hasOwnProperty("row") && 
					block.dataset.hasOwnProperty("start") &&
					block.dataset.hasOwnProperty("end"))
				{
					try {
						this._blockGridSpace(block.dataset.row, this._yearToGrid(block.dataset.start), this._yearToGrid(block.dataset.end));
					} catch(e) {
						console.log(`${e}: called for ${entry.id} with row ${row}`);
					}
				}
			}
		}
		
		/** Set the row for all entries, and return the row total
		 * @public
		 * @param Nodelist entries
		 * @return Int
		 */
		setRows(entries) {
			const manual = [...entries].filter(e => e.dataset.hasOwnProperty("row"));
			const auto = [...entries].filter(e => !e.dataset.hasOwnProperty("row"));
			
			for (const entry of manual) {
				this._setEntryRow(entry);
			}
			
			for (const entry of auto) {
				this._setEntryRow(entry);
			}
			
			return this.rows;
		}
			
		/**
		 * Set the row for the provided entry.
		 * @protected
		 * @param {HTMLElement} entry
		 */
		_setEntryRow(entry) {
			const start = this._yearToGrid(entry.dataset.start);
			const end = this._yearToGrid(this._calcGroupEnd(entry));
			let seek = null, seek2 = null, near = null;
			
			if (entry.dataset.split) {
				seek = document.getElementById(entry.dataset.split);
			}
			
			if (entry.dataset.merge) {
				const mergeEl = document.getElementById(entry.dataset.merge);
				
				//Prevent infinite recursion if merging with an entry which split from this one
				if(mergeEl.dataset.split !== entry.id) {
					seek = mergeEl;
				}
			}
			
			if (entry.dataset.fork) {
				seek = document.getElementById(entry.dataset.fork.split(" ")[0]);
			}
			
			if (seek && near === null) {
				if (!seek.dataset.row) {
					this._setEntryRow(seek);
				}
				near = parseInt(seek.dataset.row);
			}
			
			if (entry.dataset.fork) {
				seek2 = document.getElementById(entry.dataset.fork.split(" ")[1]);
				if (!seek2.dataset.row) {
					this._setEntryRow(seek2);
				}
				//Temporarily allow the space behind the entries we are forking to
				this._freeGridSpace(seek.dataset.row, this._yearToGrid(seek.dataset.start)-1, this._yearToGrid(seek.dataset.start)-1);
				this._freeGridSpace(seek2.dataset.row, this._yearToGrid(seek2.dataset.start)-1, this._yearToGrid(seek2.dataset.start)-1);
				
				near = Math.round((parseInt(seek.dataset.row) + parseInt(seek2.dataset.row)) / 2);
			}
			
			//TODO: If a forking entry has an entry which becomes it (i.e. predecessor)
			//		then its position gets forced by that before it can be calculated...
			const row = this._calcEntryRow(entry, start, end, near);
			entry.dataset.row = row;
			this._setGroupRow(entry);
			
			try {
				this._blockGridSpace(row, start, end);
				
				//Apply blocks targeted at this entry
				const block = document.querySelector('*[data-find="' + entry.id + '"]');
				if(block !== null) {
					console.log(`Blocking ${row} for ${entry.id} (${block.dataset.start} to ${block.dataset.end}`);
					this._blockGridSpace(row, this._yearToGrid(block.dataset.start), this._yearToGrid(block.dataset.end));
				}
				
			} catch(e) {
				console.log(`${e}: called for ${entry.id} with row ${row}`);
			}
			
			if (entry.dataset.fork) {
				//Block again the temporarily allowed space behind the entries we are forking to
				this._blockGridSpace(seek.dataset.row, this._yearToGrid(seek.dataset.start)-1, this._yearToGrid(seek.dataset.start)-1);
				this._blockGridSpace(seek2.dataset.row, this._yearToGrid(seek2.dataset.start)-1, this._yearToGrid(seek2.dataset.start)-1);
			}
		}
		
		/**
		 * Provide the grid X number for a given year
		 * @param {number} year
		 * @return {number}
		 */
		_yearToGrid(year) {
			return parseInt(year) - parseInt(this._yearStart);
		}
		
		/**
		 * Get the number of rows in the diagram.
		 * @return {number}
		 */
		get rows() {
			return this._grid.length;
		}
		
		/**
		 * Set the row on entries grouped with the current entry
		 * @protected
		 * @param {HTMLElement} entry
		 */
		_setGroupRow(entry) {
			if (entry.dataset.become) {
				const next = document.getElementById(entry.dataset.become);
				
				//Free up the space of the linked entry and set the row to the same as the current entry.
				if(next.dataset.row) {
					const s = next.dataset.start - this._yearStart;
					const e = next.dataset.end - this._yearStart;
					this._freeGridSpace(next.dataset.row, s, e);
				}
				next.dataset.row = entry.dataset.row;
				this._setGroupRow(next);
			}
		}
		
		/**
		 * Calculate a suitable row for an entry and return it. If the row is already set, that will be returned.
		 * @protected
		 * @param {HTMLElement} entry - the entry
		 * @param {number} start - the number of units (years) from the start of the X axis the entry must start
		 * @param {number} end - the number of units (years) from the start of the X axis the entry must end
		 * @param {HTMLElement} near - Another entry this entry should try to be near
		 * @return {number}
		 */
		_calcEntryRow(entry, start, end, near = null) {
			if (entry.dataset.row) {
				return entry.dataset.row;
			}
			if (near) {
				return this._findNearestGridSpace(parseInt(near), start, end);
			}
			return this._findGridSpace(start, end);
		}
		
		/**
		 * Calculate the end year of an entry's group (i.e. the end of the last entry to which it directly joins).
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {number}
		 */
		_calcGroupEnd(entry) {
			let end = entry.dataset.end;
			if (entry.dataset.become) {
				end = this._calcGroupEnd(document.getElementById(entry.dataset.become));			
			}
			return end;
		}
		
		/**
		 * Find a row in the grid with space between the provided start and end points.
		 * @protected
		 * @param {number} start
		 * @param {number} end
		 * @return {number}
		 */
		_findGridSpace(start, end) {
			for (let i = 0; i < this.rows; i++) {
				if (this._checkGridSpace(i, start, end)) {
					return i;
				}
			}
			this._addGridRow();
			return this.rows - 1;
		}
		
		/**
		 * Find the nearest row to that provided which is empty between start and end.
		 * @protected
		 * @param {number} y
		 * @param {number} start
		 * @param {number} end
		 */
		_findNearestGridSpace(y, start, end) {
			let before = y, after = y;
			
			if (this._checkGridSpace(y, start, end)) { return y; }
			
			while(before > -1 && !this._checkGridSpace(before, start, end)) { before--; }
			while(after < this.rows && !this._checkGridSpace(after, start, end)) { after++; }
			
			if (before == -1 && after == this.rows) {
				this._addGridRow();
				return this.rows - 1;
			}
			
			if (after == this.rows) { return before; }
			
			if (before == -1) { return after; }
			
			if ((y - before) <= (after - y)) { return before; }
			else { return after; }
		}
		
		/**
		 * Add a row to the grid.
		 * @protected
		 */
		_addGridRow() {
			this._grid.push(new Array(this._years).fill(false));
		}
		
		/**
		 * Check if the given row y is empty between start and end.
		 * @protected
		 * @param {number} y
		 * @param {number} start
		 * @param {number} end
		 * @return {boolean}
		 */
		_checkGridSpace(y, start, end) {
			//In most instances, we don't want to extend to the end of the "end" year, but to the start. So that, e.g. we can join with another entry starting on that year and not overlap.  However, entries with the same start and end must take up some space.
			if (start === end) {
				end += 1;
			}
			
			const part = this._grid[y].slice(start, end);
			let result = part.every( e => e === false);
			return result;
		}
		
		/**
		 * Set the space in row y from start to end as full.
		 * @protected
		 * @param {number} y
		 * @param {number} start
		 * @param {number} end
		 */
		_blockGridSpace(y, start, end) {
			this._markGridSpace(y, start, end, true);
		}
		
		/**
		 * Set the space in row y from start to end as empty.
		 * @protected
		 * @param {number} y
		 * @param {number} start
		 * @param {number} end
		 */
		_freeGridSpace(y, start, end) {
			this._markGridSpace(y, start, end, false);
		}
		
		/**
		 * Set the space in row y from start to end according to the state param.
		 * @protected
		 * @param {number} y
		 * @param {number} start
		 * @param {number} end
		 * @param {boolean} state
		 */
		_markGridSpace(y, start, end, state) {
			if (!this._grid[y]) {
				throw new Error(`Attempt to mark non-existent grid row ${y}`);
			}
			let n = 0;
			while (n < (end - start)) {
				this._grid[y][start+n] = state;
				n++;
			}
			
			//Mark space either end to keep entries from joining, if available
			if (start > 0) {
				this._grid[y][start-1] = state;
			}
			if (end < this._grid[0].length - 1) {
				this._grid[y][end] = state;
			}
		}
	}

	/**
	 * Takes a config object and a default config object and returns a final config with all config modifcations applied.
	 * Ensures no unwanted properties are passed in config.
	 * @param {object} defaults - The default config object with all allowed properties
	 * @param {object} conf - The config object to apply
	 * @return {object}
	 */
	function applyConfig(defaults, conf) {
		let c = {};
		
		for (const prop in defaults) {
			if(conf.hasOwnProperty(prop)) {
				c[prop] = conf[prop];
			} else {
				c[prop] = defaults[prop];
			}
		}
		return c;
	}

	/**
	 * The default configuration object for the Diagram class
	 */
	const defaultDiagramConfig = {
		yearStart: 1900,
		yearEnd: new Date().getFullYear() + 1,
		strokeWidth: 4,
		yearWidth: 50,
		rowHeight: 50,
		padding: 5,
		strokeColour: "#999",
		boxWidth: 100,
		guides: true,
		guideInterval: 5,
		entrySelector: "div",
		linkDashes: "4",
		irregularDashes: "88 4 4 4"
	};

	/**
	 * Class representing the timeline diagram drawing area. This is used by the main Timeline class.
	 * The diagram is drawn by instanciating this class and calling create() on the instance.
	 */
	class Diagram {
		
		/**
		 * Create a diagram.
		 * @param {string} container - The ID of the container element for the diagram.
		 * @param {object} config - Configuration object for the diagram. Entirely optional.
		 * @param {number} [config.yearStart = 1900] - the starting year for the timeline
		 * @param {number} [config.yearEnd = Current year + 1] - the end year for the timeline
		 * @param {number} [config.strokeWidth = 4] - the width in px of the joining lines
		 * @param {number} [config.yearWidth = 50] - the width in px of diagram used to for each year
		 * @param {number} [config.rowHeight = 50] - the height in px of each diagram row
		 * @param {number} [config.padding = 5] - the padding in px between rows
		 * @param {string} [config.strokeColour = "#999"] - the default colour for lines drawn (must be a valid colour hex)
		 * @param {number} [config.boxWidth = 100] - the width in px of each entry
		 * @param {boolean} [config.guides = true] - whether to draw striped guides at regular intervals in the timeline
		 * @param {number} [config.guideInterval = 5] - the interval in years between guides (ignored if 'guides' is false)
		 * @param {string} [config.entrySelector = "div"] - the CSS selector to match entries
		 * @param {string} [config.linkDashes = "4"] - The svg dasharray for link lines.
		 * 								Must be a valid dasharray. See <https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray>
		 * @param {string} [config.irregularDashes = "20 2"] - The svg dasharray for entries marked as 'irregular' with the data-irregular attribute.
		 * 								Must be a valid dasharray. See <https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray>
		 */
		constructor(container, config = {}) {		
			this._config = this._makeConfig(config);
			this._applyCSSProperties();
			this._container = document.getElementById(container);
			this._entries = document.querySelectorAll("#" + container + " > " + this._config.entrySelector+":not(.timeline-exclude):not(.timeline-block)");
			this._blocks = document.querySelectorAll(".timeline-block");
		}
		
		/**
		 * Take the given config, apply defaults and return final config object.
		 * @protected
		 * @param {object} config
		 * @return {object}
		 */
		_makeConfig(config) {
			const c = applyConfig(defaultDiagramConfig, config);
			//Derived settings for convenience
			c.boxHeight = c.rowHeight - c.padding*2;
			c.boxMinWidth = c.boxHeight;
			return c;
		}
		
			
		/**
		 * Set a single config property.
		 * @protected
		 * @param {string} prop
		 * @param {string} value
		 */
		_setConfigProp(prop, value) {
			this._config[prop] = value;
		}
			
		/** Create the timeline.
		 * This should be called after creating a class instance.
		 */
		create() {
			this._setup();
			this._draw();
			this._addDates();
			if (this._config.guides === true) {
				this._addGuides();
			}
			return this._container;
		}
		
		/** Setup necessary CSS classes and data for entries.
		 * @protected
		 */
		_setup() {
			this._prepareEntries();
			const dp = this._createPositioner();
			const rows = dp.setRows(this._entries);
			this._setConfigProp("rows", rows);
			
			//Set up container
			this._container.classList.add("timeline-container");
			this._container.style.height = (this._config.rows + 2) * this._config.rowHeight + "px"; //Add 2 rows to total for top and bottom space
			this._container.style.width = (this._config.yearEnd + 1 - this._config.yearStart) * this._config.yearWidth + "px"; //Add 1 year for padding
		
			this._setEntries();
		}
		
		/** Prepare all entries with initial classes and data
		 * @protected
		 */
		_prepareEntries() {
			for (const entry of this._entries) {
				entry.classList.add("entry");
				entry.dataset.end = this._calcEnd(entry);
			}
		}
		
		/**
		 * Instantiate a DiagramPositioner object and pass any initial position _blocks
		 * @protected
		 * @return DiagramPositioner
		 */
		_createPositioner() {
			const years = this._config.yearEnd - this._config.yearStart;	
			let rows = 1;
			
			//Find the highest manual row number (selector is for entries and any .timeline-block elements)
			for (const entry of this._container.querySelectorAll(this._config.entrySelector+":not(.timeline-exclude), .timeline-block")) {
				if (parseInt(entry.dataset.row) > rows) {
					rows = parseInt(entry.dataset.row);
				}
			}
			
			const dp = new DiagramPositioner(years, this._config.yearStart, rows);
			dp.applyBlocks(this._blocks);
			this._setConfigProp("rows", dp.rows);
			
			return dp;
		}
		
		/** Set the row for all entries
		 * @protected
		 * @param DiagramPositioner dp
		 */
		_setRows(dp) {
			for (const entry of this._entries) {
				dp.setEntryRow(entry);
			}
			this._setConfigProp("rows", dp.rows);
		}
		
		/**
		 * Set styles for each entry to position them according to calculated row and entry size
		 * @protected
		 */
		_setEntries() {
			//Position entries and add additional data
			for (const entry of this._entries) {
				entry.style.left = this._yearToWidth(entry.dataset.start) + "px";
				entry.style.top = (parseInt(entry.dataset.row) +1) * this._config.rowHeight + this._config.padding + "px"; //Add 1 to row due to 0 index.
				if (entry.dataset.colour) {
					entry.style.borderColor = entry.dataset.colour;
				}
				
				//Style short entries (lasting less time than the box size)
				if(this._checkSmallEntry(entry) === true) {
					entry.classList.add("min");
				}
			}
			
			//Adjust spacing for entries that overlap
			//Accomodates entries that are both the same year
			//Width needs to be known before nudging, so this has to be separated
			for (const entry of this._container.querySelectorAll(this._config.entrySelector + '[data-become]')) {
				if (entry.dataset.start == document.getElementById(entry.dataset.become).dataset.start) {
					entry.style.left = parseFloat(entry.style.left) - this._config.boxMinWidth/2 + "px";
					document.getElementById(entry.dataset.become).style.left = parseFloat(document.getElementById(entry.dataset.become).style.left) + this._config.boxMinWidth/2 + "px";
				}
			}
		}
		
		/**
		 * Add the date timelines to top and bottom of the diagram
		 * @protected
		 */
		_addDates() {
			const tl = document.createElement("div");
			tl.classList.add("dates");
			
			let y = this._config.yearStart;
			while(y < this._config.yearEnd) {
				const d = document.createElement("date");
				d.style.left = this._yearToWidth(y) + "px";
				const t = document.createTextNode(y);
				d.append(t);
				tl.append(d);
				y = y+5;
			}
			this._container.prepend(tl);
			
			const tl2 = tl.cloneNode(true);
			tl2.style.top = (this._config.rows) * this._config.rowHeight + "px";
			this._container.append(tl2);
		}
		
		/**
		 * Add striped guides to the diagram.
		 * @protected
		 */
		_addGuides() {
			let y = this._config.yearStart;

			//Round the end up to the nearest multiple of guideInterval to ensure last guide is placed.
			while(y < Math.ceil(this._config.yearEnd/this._config.guideInterval)*this._config.guideInterval) {
				const guide = document.createElement("div");
				guide.classList.add("guide");
				guide.style.left = this._yearToWidth(y) + "px";
				guide.style.width = this._config.yearWidth * this._config.guideInterval + "px";
				
				if(((y - this._config.yearStart) / this._config.guideInterval) % 2 == 1) {
					guide.classList.add("odd");
				}
				
				this._container.append(guide);
				y = y + this._config.guideInterval;
			}
		}
			
		/** Draw all lines in the timeline between entries.
		 * @protected
		 */
		_draw() {
			for (const entry of this._entries) {
				
				const colour = (entry.dataset.colour ? entry.dataset.colour : this._config.strokeColour);
				const dasharray = (entry.dataset.irregular == "true" ? this._config.irregularDashes : "");
				
				let endMarker = "";
				let cssClass = "end";
				let start = this._getJoinCoords(entry, "right");
				let end = {
					x: this._yearToWidth(entry.dataset.end),
					y: start.y
				};
				
				//Ends without joining another entry
				if (!entry.dataset.hasOwnProperty("merge") &&
					!entry.dataset.hasOwnProperty("fork") &&
					!entry.dataset.hasOwnProperty("become")
				) {
					endMarker = (entry.dataset.endEstimate ? "dots" : "circle");
				}
				
				if (entry.dataset.hasOwnProperty("become")) { 
					end = this._getJoinCoords(document.getElementById(entry.dataset.become), 'left');
					cssClass = "become";
				}
				
				if (entry.dataset.hasOwnProperty("merge")) {
					//Special case of one year length and then merging. We need to bump the merge point forward by 1 year to meet an 'end of year' point. Otherwise, it's indistinguishable from a split.
					if (entry.dataset.start == entry.dataset.end) {
						end.x += this._config.yearWidth;
					}
					
					const mergePoint = {
						x: end.x,
						y: this._getYCentre(document.getElementById(entry.dataset.merge))
					};
					
					//Merged entry's line ends a bit earlier, so as to go diagonally to meet the other entry at the year mark.
					end.x = end.x - this._config.yearWidth;
					const merge = SvgConnector.draw({ start: end, end: mergePoint, stroke: this._config.strokeWidth, colour: colour });
					merge.classList.add("merge");
					this._container.append(merge);
					cssClass = "merge";
				}
					
				//Nothing to draw here if entry starts and ends on the same year
				if (entry.dataset.start !== entry.dataset.end) {
					const line = SvgConnector.draw({ start: start, end: end, stroke: this._config.strokeWidth, colour: colour, markers: ["", endMarker], dashes: dasharray });
					line.classList.add(cssClass);
					this._container.append(line);
				}

				if (entry.dataset.hasOwnProperty("split")) {
					this._drawSplit(entry, colour);
				}
				if (entry.dataset.hasOwnProperty("fork")) {
	 				this._drawForks(entry, colour);
				}
				if (entry.dataset.hasOwnProperty("links")) {
					this._drawLinks(entry, colour);
				}
			}
		}
		
		/**
		 * Draw splits.
		 * @protected
		 * @param {HTMLElement} entry
		 * @param {string} colour
		 */
		_drawSplit(entry, colour) {
			const source = document.getElementById(entry.dataset.split);
			
			let direction = "top";
			if (parseInt(entry.dataset.row) < parseInt(source.dataset.row)) {
				direction = "bottom";			
			}
			
			const start = {
				x: this._yearToWidth(entry.dataset.start),
				y: this._getYCentre(source)
			};
			const end = this._getJoinCoords(entry, direction);
			
			const line = SvgConnector.draw( { start: start, end: end, stroke: this._config.strokeWidth, colour: colour });
			
			line.classList.add("split");
			this._container.append(line);
		}
		
		/**
		 * Draw forks.
		 * @protected
		 * @param {HTMLElement} entry
		 * @param {string} colour
		 */
		_drawForks(entry, colour) {
			const forks = entry.dataset.fork.split(" ");
			const forkYear = parseInt(entry.dataset.end);

			const start = {
				x: this._yearToWidth(forkYear),
				y: this._getYCentre(entry)
			};
			const end1 = {
				x: this._yearToWidth(forkYear+1),
				y: this._getYCentre(document.getElementById(forks[0]))
			};
			const end2 = {
				x: this._yearToWidth(forkYear+1),
				y: this._getYCentre(document.getElementById(forks[1]))
			};
			
			const fork1 = SvgConnector.draw({ start: start, end: end1, stroke: this._config.strokeWidth, colour: colour });
			const fork2 = SvgConnector.draw({ start: start, end: end2, stroke: this._config.strokeWidth, colour: colour });
			
			fork1.classList.add("fork");
			fork2.classList.add("fork");
			this._container.append(fork1, fork2);
		}
		
		/**
		 * Draw links.
		 * @protected
		 * @param {HTMLElement} entry
		 * @param {string} colour
		 */
		_drawLinks(entry, colour) {
			const links = entry.dataset.links.split(" ");
			
			//Count links drawn on each side, so additional ones can be offset to avoid overlap.
			let indices = {
				top: -1,
				bottom: -1,
				left: -1,
				right: -1
			};
			
			for (const link of links) {
				const target = document.getElementById(link);
				if (!target) {
					console.warn(`${entry.id} links to non-existant ID ${link}`);
				}
				
				let sourceSide, targetSide, start = { x: 0, y: 0}, end = { x: 0, y: 0};
				
				const eRow = parseInt(entry.dataset.row);
				const tRow = parseInt(target.dataset.row);
				
				//Find the direction of the link
				if (eRow === tRow && entry.dataset.start < target.dataset.start) {
					indices["right"] = indices["right"]+1;
					sourceSide = "right";
					targetSide = "left";
				}
				if (eRow === tRow && entry.dataset.start > target.dataset.start) {
					indices["left"] = indices["left"]+1;
					sourceSide = "left";
					targetSide = "right";
				}
				if (eRow > tRow) {
					indices["top"] = indices["top"]+1;
					sourceSide = "top";
					targetSide = "bottom";
				}
				if (eRow < tRow) {
					indices["bottom"] = indices["bottom"]+1;
					sourceSide = "bottom";
					targetSide = "top";
				}
				
				start = this._getJoinCoords(entry, sourceSide, indices[sourceSide]);
				
				//Start with vertical line to line case
				end = {
					x: start.x,
					y: this._getYCentre(target)
				};
				
				//If the target doesn't overlap in time with the source (can't be after, as link would be vice versa then)
				if(entry.dataset.start >= target.dataset.end) {
					end.x = this._yearToWidth(target.dataset.end);
				}
				
				//If the year is the same, link the entry box, not the line
				if(entry.dataset.start == target.dataset.start) {
					end = this._getJoinCoords(target, targetSide);
				}
				
				const connector = SvgConnector.draw({
					start: start,
					end: end,
					stroke: this._config.strokeWidth/2,
					colour: colour,
					markers: ["square", "square"],
					dashes: this._config.linkDashes
				});
				connector.classList.add("link");
				this._container.append(connector);
			}
		}
		
		/** Add CSS properties to document root, based on config.
		 * @protected
		 */
		_applyCSSProperties() {
			const root = document.documentElement;
			root.style.setProperty('--timeline-year-width', this._config.yearWidth + "px");
			root.style.setProperty('--timeline-row-height', this._config.rowHeight + "px");
			root.style.setProperty('--timeline-box-width', this._config.boxWidth + "px");
			root.style.setProperty('--timeline-box-height', this._config.boxHeight + "px");
			root.style.setProperty('--timeline-box-width-min', this._config.boxHeight + "px");
			root.style.setProperty('--timeline-padding', this._config.padding + "px");
			root.style.setProperty('--timeline-stroke-colour', this._config.strokeColour);
			
		}
		
		/**
		 * Find and return the coordinates where lines should join an element on each side.
		 * Where multiple lines are meeting an element on one side, specifying the offest number
		 * allows these to join at different points.
		 * @protected
		 * @param {HTMLElement} entry
		 * @param {string} side - Must be "top", "bottom", "left" or "right"
		 * @param {number} offset - the number of steps to offset the point (use if multiple lines join an entry on the same side).
		 * @return {object}
		 */
		_getJoinCoords(entry, side, offset = 0) {
			
			const offsetIncrement = 5;
			
			const status = window.getComputedStyle(entry);
			
			const l = parseFloat(entry.style.left);
			const t = parseFloat(entry.style.top);
			const w = parseFloat(status.getPropertyValue('width'));
			const h = parseFloat(status.getPropertyValue('height'));
			
			switch(side) {
				case 'left':
					return {
						x: l,
						y: t + h/2 + (offset * offsetIncrement)
					};
				case 'right':
					return {
						x: l + w,
						y: t + h/2 + (offset * offsetIncrement)
					};
				case 'top':
					return {
						x: l + w/2 + (offset * offsetIncrement),
						y: t
					};
				case 'bottom':
					return {
						x: l + w/2 + (offset * offsetIncrement),
						y: t + h
					};
				default:
					throw `Invalid element side specified: Called with ${side}. Entry: ${entry}`;
			}
		}
		
		/**
		 * Return the end date for an entry, whether explicitly set or not.
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {number}
		 */
		_calcEnd(entry) {
			if (entry.dataset.end) {
				return parseInt(entry.dataset.end);
			}
			
			if (entry.dataset.become) {
				return parseInt(document.getElementById(entry.dataset.become).dataset.start);
			}
			
			if (entry.dataset.fork && !entry.dataset.end) {
				const forks = entry.dataset.fork.split(" ");
				const f1 = document.getElementById(forks[0]);
				const f2 = document.getElementById(forks[1]);
				return parseInt(Math.max(f1.dataset.start, f2.dataset.start));
			}
			
			return parseInt(this._config.yearEnd);
		}

		/**
		 * Check if an entry should be small on the graph (too brief to fit full box size)
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {boolean}
		 */
		_checkSmallEntry(entry) {
			const start = entry.dataset.start;
			const end = entry.dataset.end;
			
			if ((end - start) < (this._config.boxWidth/this._config.yearWidth)) {
				return true;
			} else {
				return false;
			}
		}
		
		/**
		 * Get the X-axis centre of an entry box.
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {number}
		 */
		_getXCentre(entry) {
			return parseFloat(entry.style.left) + (this._config.boxWidth/2);
		}
		
		/**
		 * Get the Y-axis centre of an entry box.
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {number}
		 */
		_getYCentre(entry) {
			return parseFloat(entry.style.top) + (this._config.boxHeight/2);
		}
		
		/**
		 * Get the width in px of the diagram at the point sepecified by a particular year.
		 * @param {number} year
		 * @protected
		 * @return {number}
		 */
		_yearToWidth(year) {
			return parseInt((year - this._config.yearStart) * this._config.yearWidth);
		}
	}

	/** Timeline
	 *Copyright (C) 2021 Aonghus Storey
	 *
	 * This program is free software: you can redistribute it and/or modify
	 * it under the terms of the GNU General Public License as published by
	 * the Free Software Foundation, either version 3 of the License, or
	 * (at your option) any later version.
	 *
	 * This program is distributed in the hope that it will be useful,
	 * but WITHOUT ANY WARRANTY; without even the implied warranty of
	 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	 * GNU General Public License for more details.
	 *
	 * You should have received a copy of the GNU General Public License
	 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
	 */

	/**
	 * The default configuration object for the Timeline
	 */
	const defaultTimelineConfig = {
		panzoom: false,
		findForm: "timeline-find",
		zoomIn: "timeline-zoom-in",
		zoomOut: "timeline-zoom-out",
		zoomReset: "timeline-zoom-reset"
	};

	/**
	 * The class representing the Timeline.  This is the point of access to this tool.
	 * The simplest usage is to instantiate a new Timeline object, and then call the create() method.
	 * @alias Timeline
	 */
	class Timeline {
		/**
		 * @param {string} [container = diagram] - The ID of the container element for the timeline.
		 * @param {object} [config] - All config for the timeline
		 * @param {boolean} [config.panzoom = false] - Whether to apply panning and zooming feature to the timeline.
		 * @param {string} [config.findForm = timeline-find] - The ID of the find form
		 * @param {string} [config.zoomIn = timeline-zoom-in] - The ID of the button to zoom in
		 * @param {string} [config.zoomOut = timeline-zoom-out] - The ID of the button to zoom out
		 * @param {string} [config.zoomReset = timeline-zoom-reset] - The ID of the button to reset the zoom level
		 * @param {number} [config.yearStart = 1900] - the starting year for the timeline
		 * @param {number} [config.yearEnd = Current year + 1] - the end year for the timeline
		 * @param {number} [config.strokeWidth = 4] - the width in px of the joining lines
		 * @param {number} [config.yearWidth = 50] - the width in px of diagram used for each year
		 * @param {number} [config.rowHeight = 50] - the height in px of each diagram row
		 * @param {number} [config.padding = 5] - the padding in px between rows
		 * @param {string} [config.strokeColour = #999] - the default colour for lines drawn (must be a valid colour hex)
		 * @param {number} [config.boxWidth = 100] - the width in px of each entry
		 * @param {boolean} [config.guides = true] - whether to draw striped guides at regular intervals in the timeline
		 * @param {number} [config.guideInterval = 5] - the interval in years between guides (ignored if 'guides' is false)
		 * @param {string} [config.entrySelector = div] - the CSS selector used for entries
		 */
		constructor(container = "diagram", config = {}) {
			this._container = container;
			this._setConfig(config);
		}
		
		/**
		 * Create the Timeline. This should be called after instantiation.
		 */
		create() {
			const d = new Diagram(this._container, this._diagramConfig);
			this._diagram = d.create();

			if (this._config.panzoom === true) {
				this._initPanzoom();
				this._initControls();
				window.addEventListener('hashchange', (e) => this._hashHandler(e));
			}
			if (location.hash) {
				setTimeout(() => {
					this._hashHandler();
				});
			}
		}
		
		/**
		 * Take the provided config, separate config for the Diagram drawing class, and add in defaults for undefined properties.
		 * @private
		 * @param {object} config
		 */
		_setConfig(config) {
			this._config = applyConfig(defaultTimelineConfig, config);
			this._diagramConfig = applyConfig(defaultDiagramConfig, config);
		}
		
		/**
		 * If Panzoom is enabled, pan to the element with the given ID, and reset the zoom.
		 * @param {string} id - The ID of a timeline entry
		 * @fires Timeline#timelineFind
		 */
		panToEntry(id) {
			if (this._config.panzoom !== true) {
				throw new Error("Panzoom not enabled. Enable Panzoom to use the pan-to-entry feature.");
			}
			if (typeof this._pz === "undefined") {
				throw new Error("Panzoom module missing. Include Panzoom to use the pan-to-entry feature.");
			}
			
			const target = document.getElementById(id);
			const x = window.innerWidth/2 - parseInt(target.style.left) - this._diagramConfig.boxWidth/2;
			const y = window.innerHeight/2 - parseInt(target.style.top) - this._diagramConfig.rowHeight/2;
					
			this._pz.zoom(1);
			this._pz.pan(x, y);
			
			const tlFind = new CustomEvent('timelineFind', { detail: { id: id, name: target.innerText } });
			document.getElementById(this._container).dispatchEvent(tlFind);
			
			setTimeout( () => { target.classList.add("highlight", "hover"); }, 500);	
			setTimeout( () => { target.classList.remove("highlight", "hover"); }, 2000);
		}
		
		/**
		 * timelineFind event.
		 * @event Timeline#timelineFind
		 * @type {object}
		 * @property {object} details
		 * @property {string} details.id - the ID of the entry
		 * @property {string} details.name - the name of the entry
		 */
		
		/**
		 * Bind the zoom controls to the configured element IDs, if present in the document.
		 * Prepare empty container for entry filter if find form is present.
		 * @private
		 */
		_initControls() {
			const zoomIn = document.getElementById(this._config.zoomIn);
			const zoomOut = document.getElementById(this._config.zoomOut);
			const reset = document.getElementById(this._config.zoomReset);
			const find = document.getElementById(this._config.findForm);
			
			if(zoomIn) { zoomIn.addEventListener("click", this._pz.zoomIn); }
			if(zoomOut) { zoomOut.addEventListener("click", this._pz.zoomOut); }
			if(reset) { reset.addEventListener("click", () => this._pz.zoom(1)); }
			if(find) {
				this._initFindForm(find);
			}
		}
		
		/**
		 * Set up the find form
		 * @private
		 */
		_initFindForm(form) {
			//Add the ID input
			const idInput = document.createElement("input");
			idInput.name = "find-id";
			idInput.style.display = "none";
			form.append(idInput);
			
			//Add the wrappers and container for the filtering results
			const finder = form.querySelector("input[name=finder]");
			const wrap = document.createElement("div");
			const inner = document.createElement("div");
			const results = document.createElement("ul");
			wrap.classList.add("filtered-entries");
			wrap.appendChild(inner);
			inner.appendChild(results);
			finder.parentNode.insertBefore(wrap, finder);
			wrap.appendChild(finder);
			
			//Get rid of browser suggestions
			finder.autocomplete = "off";
			
			//Set results container width to match the input
			inner.style.width = finder.offsetWidth + "px";
			
			//Set config for convenience of other methods
			const findConfig = {
				form: form,
				finder: finder,
				id: idInput,
				results: results
				
			};
			this._findConfig = findConfig;
			
			//Stop refresh keeping a previous value (which won't be valid without corresponding ID)
			findConfig.finder.value = "";
			
			form.addEventListener('input', (e) => this._showEntryOptions(e));
			form.addEventListener('submit', (e) => this._findSubmit(e));
			results.addEventListener('click', (e) => this._selectFilteredEntry(e) );
		}
		
		/**
		 * Add entries to the "#filtered-entries", filtered by the value of the event-triggering input.
		 * @private
		 * @param {object} e
		 */
		_showEntryOptions(e) {
			const val = e.target.value;
			if (val.trim() === "") {
				this._findConfig.results.innerHTML = "";
				return null;
			}
			
			const filtered = this._filterEntries(val);
			const results = this._findConfig.results;
			results.innerHTML = "";
			
			for (const entry of filtered) {
				const item = document.createElement("li");
				item.dataset.id = entry.id;
				item.innerText = entry.name;
				results.append(item);
			}
		}
		
		/**
		 * Filter the list of entries to match the provided search string.
		 * @private
		 * @param {string} search
		 * @return {array}
		 */
		_filterEntries(search) {
			const filtered = [...document.querySelectorAll(".entry")]
			.map(entry => {
				return { "id": entry.id, "name": entry.innerText }
			})
			.filter(entry => {
				return entry.name.toLowerCase().includes(search.toLowerCase());
			});
			return filtered;
		}
		
		/**
		 * Submit the clicked entry in the filtered list.
		 * @private
		 * @param {object} e
		 */
		_selectFilteredEntry(e) {
			if(e.target.localName !== "li") return null;
			
			const form = this._findConfig.form;
			const finder = this._findConfig.finder;
			const id = this._findConfig.id;
			
			finder.value = e.target.innerText;
			id.value = e.target.dataset.id;
			
			form.requestSubmit();
		}
		
		/**
		 * The submit action of the find form.
		 * Pan to the entry with submitted ID, if it exists.
		 * @private
		 * @param {object} e
		 * @fires Timeline#timelineFind
		 */
		_findSubmit(e) {
			e.preventDefault();
			
			const find = e.target.querySelector("input[name=find-id]").value;
			e.target.querySelector("input[name=finder]").value;
			
			if(document.getElementById(find)) this.panToEntry(find);

			this._findConfig.results.innerHTML = "";
			this._findConfig.finder.value = "";
		}
		
		/** 
		 * Initialised Panzoom on the diagram.
		 * @private
		 * @throws {Error} Will throw an error if Panzoom isn't found.
		 */
		_initPanzoom() {
			if (typeof Panzoom === "undefined") {
				throw new Error("Missing dependency. External Panzoom library (@panzoom/panzoom) is required to use the panzoom feature.");
			}
			
			const wrap = document.createElement("div");
			wrap.classList.add("pz-wrap");
			this._diagram.parentNode.insertBefore(wrap, this._diagram);
			wrap.appendChild(this._diagram);
			
			this._pz = Panzoom(this._diagram, {
				contain: 'outside',
				maxScale: 3,
				minScale: 0.5,
				step: 0.1,
				
				//This option removes the default 'stopPropagation', which blocks touch events on clickable nodes.
				handleStartEvent: (event) => {
					event.preventDefault();
				}
			});
			this._diagram.parentElement.addEventListener('wheel', this._pz.zoomWithWheel);
		}
		
		/**
		 * Handle URL hash. Hash of format '#find-{ID}' will pan to the given entry ID, if it exists.
		 * @private
		 * @param {object} e
		 */
		_hashHandler(e) {
			const id = location.hash.replace('#find-', '');
			if(document.getElementById(id) && this._pz) this.panToEntry(id);
		}
	}

	return Timeline;

}));
