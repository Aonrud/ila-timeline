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
		 * @param {string[]} [settings.markers] - An array of two string values indicating the start and end markers respectively.
		 * 		Valid values are "circle", "square" and "dots" (the last can only be used for end).
		 * @param {string} [settings.dashes] - A dasharray string for the SVG line. If omitted, a solid line will be used.
		 * 		Must be a valid SVG dasharray (@see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray})
		 * @param {String} [settings.title] - If included, a title element will be included on the line with the given text.
		 * @return {SVGSVGElement}
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
		 * @typedef {{ x1: number, x2: number, y1: number, y2: number }} Coords
		 */
		
		/**
		 * Add a marker to the svg provided at the end specified.
		 * @param {SVGSVGElement} svg - The svg node to which the marker should be added
		 * @param {("circle"|"square"|"dots")} type - One of "circle", "square" or "dots"
		 * @param {('start'|'end')} pos
		 * @param {Coords} coords
		 * @param {number} stroke
		 * @param {string} colour
		 * @return {SVGSVGElement}
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
		 * @param {('start'|'end')} pos - Either "start" or "end"
		 * @param {Coords} coords - the four coords of the line
		 * @param {number} stroke - the stroke width
		 * @param {string} colour - the drawing colour
		 * @return {SVGRectElement}
		 */
		static _drawSquareMarker(pos, coords, stroke, colour) {
			let [x, y] = [coords.x1 - stroke, coords.y1 - stroke];
			if (pos == "end") [x, y] = [coords.x2 - stroke, coords.y2 - stroke];
			return this.drawSquare(x, y, stroke * 2.5, colour);
		}
		
		/**
		 * Draw a circle marker at the given position of the line represented by the given coords.
		 * @param {('start'|'end')} pos - Either "start" or "end"
		 * @param {Coords} coords - the four coords of the line
		 * @param {number} stroke - the stroke width
		 * @param {string} colour - the drawing colour
		 * @return {SVGCircleElement}
		 */
		static _drawCircleMarker(pos, coords, stroke, colour) {
			let [x, y] = [coords.x1, coords.y1];
			if (pos == "end") [x, y] = [coords.x2, coords.y2];
			return this.drawCircle(x, y, stroke, colour);
		}
		
		/**
		 * Draw dots marker at the end of the line.
		 * (Note - requires full line coords, because marker has direction)
		 * @param {Coords} coords - the 4 coords of the line being marked
		 * @param {number} stroke - the stroke width of the line
		 * @param {string} colour - the drawing colour.
		 * @return {SVGLineElement}
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
		 * @param {Coords} coords - the x and y coordinates of the start and end points of the line
		 * @param {string} colour - The colour of the line. Must be a valid hex colour.
		 * @param {number} width - The width in px of the line
		 * @param {string} [dashes] - The dasharray pattern of the line. If omitted, it will be solid.
		 * 		Must be a valid SVG dasharray (@see {@link https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray})
		 * @param {String} [title] - If included, a title element will be included with the given text.
		 * @return {SVGLineElement}
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
		 * @param {string} [title] - If included, a title element will be included with the given text.
		 * @return {SVGCircleElement}
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
		 * @param {string} colour - The colour of the square. Must be a valid CSS colour string.
		 * @param {String} [title] - If included, a title element will be included with the given text.
		 * @return {SVGRectElement}
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
		 * @return {SVGTitleElement}
		 */
		static _createTitle(title) {
			
			const t = document.createElementNS(svgns, "title");
			t.append(document.createTextNode(title));
			t.dataset.title = title;
			return t;
		}
	}

	/**
	 * TODO:
	 * 1. Make inserting row into a cluser relative to cluster positions (i.e. don't widen the separation between clustered
	 * 		entries if not needed. Should be possible by only shunting the required year range instead of the whole row.
	 * 2. Implement grouping - assigning group to entries regardless of direct cluster link
	 * 3. Order positioning of splits reverse-chronologically so space is allocated without overlap.
	 * 4. Check for splits close to each other and select alternating sides.
	 * 5. Add grouping option (possibly just extending the cluster groups to include free-floating entries?)
	 * 6. Fix manually set rows (currently getting ignored when forcing entry posiitions)
	 */

	/**
	 * @typedef {string} EntryID
	 * 
	 * @typedef {Object} DiagramEntry
	 * @property {EntryID} id
	 * @property {number} start
	 * @property {number} end
	 * @property {number} [row]
	 * @property {EntryID} [merge]
	 * @property {EntryID} [split]
	 * @property {EntryID[]} [links]
	 * @property {DiagramEntry[]} [cluster]
	 * @property {{EntryID: { row: number, relative: number, actual: number}}} [relativeRows]
	 * @property {number} [rowTemp]
	 * 
	 * @typedef {boolean[]} GridRow
	 * 
	 * @typedef {GridRow[]} DiagramGrid
	 * A two-dimensional array of boolean values, used as a grid to represent space in the diagram
	 * 
	 */

	/**
	 * DiagramPositioner calculates where entries should be positioned on the y axis
	 * and then applies the 'data-row' attribute to the nodes provided.
	 */
	class DiagramPositioner {
		
		/**
		 * @type {NodeList}
		 */
		_nodes
		
		/**
		 * @type {DiagramEntry[]}
		 */
		_entries
		
		/**
		 * @type {DiagramGrid}
		 */
		_grid
		
		/**
		 * @type {number}
		 */
		_yearStart
		
		/**
		 * @type {number}
		 */
		_yearEnd
		
		/**
		 * @type {number}
		 */
		_xLength
		
		/**
		 * @param {Nodelist} nodes
		 * @param {number} yearStart
		 * @param {number} yearEnd
		 */
		constructor(nodes, yearStart, yearEnd) {
			this._nodes = nodes;
			this._entries = this._readEntries(nodes);
			this._yearStart = yearStart;
			this._yearEnd = yearEnd;
			this._xLength = yearEnd - yearStart + 1;
			this._grid = this._createGrid(this._entries);
			
			//Calculate the positions
			this._position();
			
			//Apply the positions to the entry nodes
			this._applyToNodes();
			
			console.log(this._order);
			console.log(this._entries);
		}
		
		/**
		 * Apply the calculated rows in this._entries to all entry nodes.
		 */
		_applyToNodes() {
			for (const e of this._entries) {
				if (e.ids) {
					for (const id of e.ids) document.getElementById(id).dataset.row = e.row;
				} else {
					document.getElementById(e.id).dataset.row = e.row;
				}
			}
		}

		/**
		 * Position the entry rows.
		 */
		_position() {
			//Order of calculation:
			//1. Relationship clusters that are linked to others should be positioned first.
			//2. Then any remaining relationship clusters.
			//3. Then any remaining entries.
			
			/**
			 * @type {EntryID[]} Temporary container to record the order of execution for related clusters.
			 */
			this._order = [];
			
			for (let e of this._entries.filter( e => e.cluster )) {
				e = this._calculateClusterPositions(e);
			}
			
			while (this._entries.find(e => e.cluster && isNaN(e.row))) {
				this._positionCluster(this._findRelatedClusterSource(this._entries.find(e => e.cluster && isNaN(e.row))));
			}
			
			//TODO: Do better than running the loop twice? lazy...
			for (const id of this._order.reverse()) {
				this._adjustCluster(this._findEntriesByValue("id", id)[0]);
			}
			
			//Any entries left.
			console.log(`Left over:`);
			for (const e of this._entries.filter( e => e.row === undefined)) {
				const row = this._getAnyRow(e.start, e.end);
				this._assignRow(row, e);
				console.log(`${e.id}: ${row}`);
			}
			
			//Check outcome accuracy
			for (const e of this._entries) {
				e.deviation = 0;
				for (const key in e.relativeRows) {
					e.relativeRows[key].actual = e.row - this._findEntriesByValue("id", key)[0].row;
					e.deviation += Math.abs(e.relativeRows[key].relative - e.relativeRows[key].actual);
				}
			}
		}
		
		/**
		 * Apply row positions to the cluster for this entry.
		 * @param {DiagramEntry} entry
		 */
		_positionCluster(entry) {
			let log = false;
			if (entry.id == "G") log = true;
			
			this._order.push(entry.id);
			console.log(`${entry.id}: root is ${this._findRelatedClusterSource(entry).id}`);
			if (entry.grid === undefined) throw new Error(`Tried to position ${entry.id} without a calculated group grid.`);
			let space = this._fitCluster(entry);
			console.log(`Group: ${entry.id}`);
			console.log(`${entry.id} grid check: ${JSON.stringify(space)}`);
			
			if (!space.fit && entry.row) {
				//If a partial fit was returned but the master grid isn't long enough from that point, extend it.
				while (space.row !== null && entry.grid.length + space.row > this._grid.length) {
					this._addGridRow();
				}
				space = this._fitCluster(entry);
	// 			console.log(`${entry.id} no fit at current row. Try row+1`);
				//Otherwise, force it.
				space = this._forceCluster(entry);
				console.log(`${entry.id} forced: ${JSON.stringify(space)}`);
			}
			
			//Try fitting if we shunt the first failed row of the cluster grid. 
			if (!space.fit) {
				this._shuntClusterEntries(space.count, 1, entry);
				space = this._fitCluster(entry);
				console.log(`${entry.id} shunted at ${space.count}. Check: ${JSON.stringify(space)}`);
			}
			
			if (space.fit) {
				for (const c of entry.cluster) {
					if (log) console.log(`Existing row for ${c.id}: ${c.row}`);
					console.log(space);
					const row = (c.row ? c.row : space.row + c.relativeRows[entry.id].row);
					console.log(`${c.id}: ${row}`);
					if (c.row !== row) this._assignRow(row, c);
					if (c.cluster) c.anchor = row;
				}
			}
			
			//Recursively position groups linked to this one, if they aren't already complete (all entries have a row)
			for (const cluster of entry.cluster.filter( e => {
				if(e !== entry && e.cluster && e.cluster.map( r => !r.row).length > 0) return true;
			})) {			
				console.log(`${entry.id}: Moving to linked cluster ${cluster.id}`);
				this._positionCluster(cluster);
			}
		}
		
		/**
		 * Follow the chain of relationships back to the root cluster and return that entry.
		 * @param {DiagramEntry} entry
		 * @return {DiagramEntry}
		 */
		_findRelatedClusterSource(entry) {
			let go = entry;
			console.log(`Following chain for ${entry.id}`);
			
			//Entries to which this group is linked by membership, excluding itself
			const steps = this._findEntriesByValue("cluster", entry).filter(e => e.id !== entry.id);
			console.log(steps);
			for (const step of steps) {
				
				//If linked by split and merge to different groups, the root is the group split from
				if (step.id == entry.merge && entry.split && !step.cluster.includes(this._findEntriesByValue("id", entry.split))) {
					console.log(`Choosing split branch to recurse`);
					break;
				}
				
				go = this._findRelatedClusterSource(step);
			}
			console.log(`${entry.id} chains with ${go.id}`);
			return go;
		}
		
		/**
		 * Calculate the relative positions of entries in the same cluster as the provided entry.
		 * @param {DiagramEntry} entry
		 */
		_calculateClusterPositions(entry) {
			/*
			 * Order of priority:
			 * 1. Master entry
			 * 2. Split & merge
			 * 3. Splits
			 * 4. Merges
			 */
			
			let gridAbs = this._createGrid(entry.cluster);
			let grid = this._makeGridRelative(gridAbs);
			const diff = gridAbs.length - grid.length;
			entry.grid = grid;
			
			//If any rows are already assigned
			for (const c of entry.cluster.filter(e => e.row)) {
				entry.rowTemp = c.row - parseInt(diff);
			}
			
			//First, set the master entry
			if (entry.rowTemp === undefined) { 
				entry.rowTemp = this._getAnyRow(entry.start, entry.end, entry);
				entry.grid = this._blockGridRow(entry.rowTemp, this._yearToGrid(entry.start), this._yearToGrid(entry.end), entry.grid);
			}
			
			//Splits & merges
			let SplitsMerges = entry.cluster.filter(e => e.merge == entry.id || e.split == entry.id);
			SplitsMerges.sort( (a, b) => {
				const y1 = (a.split == entry.id ? a.start : a.merge);
				const y2 = (b.split == entry.id ? b.start : b.merge);
				return y1 - y2;
			});
			for (const c of SplitsMerges) {
				
			}
			
			//Arbitrarily assign remaining
			for (const c of entry.cluster.filter(c => c.rowTemp === undefined)) {
				let row = this._getAnyRow(c.start, c.end, entry);
				entry.grid = this._blockGridRow(row, this._yearToGrid(c.start), this._yearToGrid(c.end), entry.grid);
				c.rowTemp = row;
			}
			
			for (const c of entry.cluster) {
				const rel = c.relativeRows || {};
				rel[entry.id] = { "row": c.rowTemp, "relative": c.rowTemp - entry.rowTemp};
				c.relativeRows = rel;
			}
			
			for (const c of entry.cluster) {
				delete c.rowTemp;
			}
			return entry;
		}
		
		/**
		 * Prepare the list of entries from the given NodeList.
		 * @param {NodeList} nodes
		 * @return {DiagramEntry[]}
		 */
		
		_readEntries(nodes) {
			let entries = [...nodes].map( e => { 
				let o = { "id": e.id };
				for (const d in e.dataset) {
					let val = ( e.dataset[d].split(" ").length > 1 ? e.dataset[d].split(" ") : e.dataset[d] );
					if (!isNaN(val)) val = parseInt(val);
					o[d] = val;
				}
				return o;
			});
			
			//Parse chains of 'become' nodes into a single entry
			for (const e of entries.filter( e => e.become).sort( (a, b) => a.start - b.start)) {
				if(entries.includes(e)) {
					const n = this._mergeBecomeEntries(e, entries);
					entries.splice(entries.indexOf(e), 1, n);
					for (const [i, id] of n.ids.entries()) {
						if (i > 0) { 
							const j = entries.findIndex(e => e.id == id);
							entries.splice(j, 1);
						}
					}
				}
			}
			
			//Entries could now be linked to deleted entries - re-assign to the single chained entry
			for (let entry of entries.filter( e => e.merge).concat(entries.filter( e => e.split))) {
				entry = this._removeBadIds(entry, entries);
			}
			
			//For convenience, give both the entry and linked entries knowledge of their relationship
			for (const e of entries) {
				const cluster = this._getCluster(e, entries);
				if (cluster.length > 1) e.cluster = cluster;
			}
			return entries;
		}
		
		/**
		 * Merge all entries that are chained to the given entry with the 'become' property
		 * @param {DiagramEntry} e
		 * @param {DiagramEntry[]} entries
		 * @return {DiagramEntry}
		 */
		_mergeBecomeEntries(e, entries) {
			e = { ...e };
			let t = { ...entries.find(x => (x.ids ? x.ids.includes(e.become) : x.id === e.become)) };
			if (t.become) t = this._mergeBecomeEntries(t, entries);
			
			e.ids = (t.ids ? [].concat(e.id, t.ids) : [].concat(e.id, t.id));
			e.chain = true;
			e.end = t.end;
			delete e.become;
			if (t.merge) e.merge = t.merge;

			return e;
		}
		
		/**
		 * Remove IDs from the entry's properties which don't refer to a valid entry id in
		 * the array of entries.
		 * @param {DiagramEntry} entry
		 * @param {DiagramEntry[]} entries
		 * @return {DiagramEntry}
		 */
		_removeBadIds(entry, entries) {
			const props = [ "merge", "split" ];
			for (const prop of props) {
				if (entry[prop] && this._findEntriesByValue("id", entry[prop], entries).length === 0) {
					entry[prop] = this._findEntriesByValue("ids", entry[prop], entries)[0].id;
				}
			}
			return entry;
		}
		
		/**
		 * Get an array of all entries in 'entries' that are in the same cluster as entry.
		 * @param {DiagramEntry} entry
		 * @param {DiagramEntry[]} entries
		 * @return {DiagramEntry[]}
		 */
		_getCluster(entry, entries) {
			let cluster = [ entry ];

			//Add splits
			cluster = cluster.concat(this._findEntriesByValue("split", entry.id, entries));
			
			//Add merges, but exclude these circumstances:
			//1. This entry split from the merging entry (break the loop)
			//2. The merging entry merges at the start of this one
			//		(more like a predecessor - treat the relationship the other way around)
			cluster = cluster.concat(this._findEntriesByValue("merge", entry.id, entries).filter(m => entry.split !== m.id && m.end !== entry.start));
			
			//Add entries to which this merges if they only start at that point (inverse of 2. above)
			cluster = cluster.concat(this._findEntriesByValue("id", entry.merge, entries).filter( e => e.start == entry.end));
			
			return cluster;
		}
		
		/**
		 * Entry filtering.
		 */
		
		/**
		 * @protected
		 * @param {string} prop
		 * @param {string} value
		 * @param {DiagramEntry[]} [entries = this._entries]
		 * @return {DiagramEntry[]}
		 */
		_findEntriesByValue(prop, value, entries = this._entries) {
			//Properties could be arrays, in which case we check includes
			return entries.filter( e => {
				if (!e[prop]) return false;
				if (Array.isArray(e[prop])) return e[prop].includes(value);
				return e[prop] === value;
			});
		}
		
		/**
		 * @protected
		 * @param {string} prop
		 * @param {string[]} values
		 * @param {DiagramEntry[]} [entries = this._entries]
		 * @return {DiagramEntry[]}
		 */
		_findEntriesByValues(prop, values, entries = this._entries) {
			if (!values) throw new Error(`Find by values called without values: ${prop} ${values}`);
			let result = [];
			for (const v of values) {
				result = result.concat(this._findEntriesByValue(prop, v, entries));
			}
			return result;	
		}
		
		/**
		 * @typedef {object} EntryFilters
		 * @property {string[]} all
		 * @property {string[]} any
		 * @property {string[]} none
		
		/**
		 * @protected
		 * @param {EntryFilters} filters
		 * @param {string[]} values
		 * @param {DiagramEntry[]} [entries = this._entries]
		 * @return {DiagramEntry[]}
		 */
		_findEntriesByProperties(filters, entries = this._entries) {
			for (const f in filters) {
				if (typeof filters[f] === "string") filters[f] = [ filters[f] ];
			}
			
			for (const f of ["all", "any", "none"]) {
				if (!filters[f]) filters[f] = [];
			}
			
			return entries.filter( (e) => filters.all.every( item => e[item] ) && filters.none.every( item => !e[item] ) && filters.any.some( item => e[item]));
		}
		
		/**
		 * Entry moving functions. Grid will also be modified to accomodate.
		 */
		
		/**
		 * @param {number} row
		 * @param {number} count
		 * @param {DiagramEntry} entry
		 * @return {number}
		 */
		_shuntClusterEntries(row, count, entry) {
			if (count === 0) return row;
			const insert = Array.from(Array(count), () => new Array(this._xLength).fill(false));
			
			entry.grid.splice(row, 0, ...insert);

			//Move the entries (if they have a row calculated for this group).
			for (const e of entry.cluster.filter( e => e.rowTemp || e.relativeRows )) {
				
				if (e.rowTemp === undefined && e.relativeRows.hasOwnProperty(entry.id)) e.rowTemp = e.relativeRows[entry.id].row;
				if ( e.rowTemp >= row) e.rowTemp = e.rowTemp + count;
				
				if (e.relativeRows && e.relativeRows[entry.id]) {
					e.relativeRows[entry.id].row = e.rowTemp;
					delete e.rowTemp;
				}
			}
			return row;
		}
		
		/**
		 * Position functions. Grid will be modified as required.
		 */
		
		/**
		 * Assign the row to the entry and block the master grid for that position.
		 * If the entry row was already assigned, free that space and re-assign.
		 * @param {number} row
		 * @param {DiagramEntry} entry
		 */
		_assignRow(row, entry) {
			if (entry.row) {
				this._freeGridRow(entry.row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), this._grid);
			}
			entry.row = row;
			this._blockGridRow(row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), this._grid);
		}
		
		/**
		 * Assign the row to the entry for that related cluster and block the relative grid for that position.
		 * @param {number} row
		 * @param {DiagramEntry} entry
		 */
		_assignClusterRow(row, entry) {
			entry.rowTemp = row;
			entry.grid = this._blockGridRow(row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), entry.grid);
		}
		
		/**
		 * Get any row with space between 'start' and 'end'.
		 * If none exists, create a new row.
		 * @param {number} start
		 * @param {number} end
		 * @param {DiagramEntry} [entry] If provided, the relative grid of this entry will be used (not the master grid).
		 * @return {number}
		 */
		_getAnyRow(start, end, entry) {
			let grid = (entry ? entry.grid : this._grid);
			let row = this._checkGridRange(this._yearToGrid(start), this._yearToGrid(end), 0, null, grid);
			if (!row && row !== 0) {
				grid = this._addGridRow(grid);
				row = grid.length - 1;
			}
			return row;
		}
		
		/**
		 * TODO: this needs to be fixed to account for cases where some rows are already set.
		 * It pulls set rows out of the relative grid to check, but needs a 'check around this exact row' function.
		 */
		
		/**
		 * @typedef {object} GridCheck
		 * @property {boolean} fit
		 * @property {number} row
		 * @property {number} count
		 * @property {number} [requested]
		 */
		
		/**
		 * See if there is a place in the master grid where the cluster grid of the entry can fit.
		 * If the master grid isn't yet as large as the cluster grid, it will be expanded before checking.
		 * If 'move' is specified, check if it would fit when existing row positions are moved by that number.
		 * @param {DiagramEntry} entry
		 * @param {number} [move]
		 * @return {GridCheck}
		 */
		_fitCluster(entry) {
			let log = false;
			if (entry.id == "C") log = true;
			if (log) console.log(`Cluster grid: ${this._gridString(entry.grid)}`);
			if (log) console.log(`Master grid: ${this._gridString(this._grid)}`);
			
			//If the master grid is too small, expand it
			while (this._grid.length < entry.grid.length) {
				this._grid = this._addGridRow();
			}
					
			//If some entries already have a row set, then we don't need to look in the master grid for that space.
			for(const a of entry.cluster.filter(b => b.row)) {
				this._freeGridRow(a.relativeRows[entry.id].row, this._yearToGrid(a.start), this._yearToGrid(a.end), entry.grid);
			}
			
			const position = (entry.row ? entry.row - entry.relativeRows[entry.id].row : null);
			let r = this._checkFitInGrid(entry.grid, this._grid, position);
			
			//If a row was requested and grid1 falls off the end of grid2 that's fine as it means we can add rows
			//to get a fit.
			while (r.row > 0 && this._grid.length < entry.grid.length + r.row) {
				this._addGridRow();
				console.log(`Adding row to master grid`);
			}
			r = this._checkFitInGrid(entry.grid, this._grid, position);
			
			//If there isn't even space for the first row, and we're not anchored anywhere, add rows for the whole group
			const x = this._grid.length + entry.grid.length;
			while (r.row == null && !entry.row && this._grid.length < x) this._addGridRow();
			r = this._checkFitInGrid(entry.grid, this._grid, position);
			
			
			//If a specific row was requested, return an alternative, if available.
			const alternative = this._checkFitInGrid(entry.grid, this._grid, position);
			if (position !== null && r.fit === false) r.alternative = alternative;
			
			if (log) console.log(r);
			
			//Block the cluster grid again so it's preserved.
			for(const a of entry.cluster.filter(b => b.row)) {
				this._blockGridRow(a.relativeRows[entry.id].row, this._yearToGrid(a.start), this._yearToGrid(a.end), entry.grid);
			}
			return r;
		}
		
		/**
		 * Force a space into the master grid for this entry's cluster grid.
		 * If row isn't specified, the entry.row property will be used.
		 * @param {DiagramEntry} entry
		 * @param {number} row The row at which to insert the group - this is the master entry row, not necessarily the 1st
		 * @return {GridCheck}
		 */
		_forceCluster(entry, row) {
			if (row === undefined && !entry.row) throw new Error(`Cannot force position without a row: ${entry.id}`);
			if (row === undefined) row = entry.row;

			console.log(`Working through group to force insert: ${entry.id}.`);
			
			const diff = row*1 - entry.relativeRows[entry.id].row;
			
			//First, force the master entry of the group, if not already set
			if(!entry.row) {
				const moved = this._freePosition(row, entry);
				console.log(moved);
			}
			
			//Then the rows before the master
			for (const e of entry.cluster.filter(e => e.relativeRows[entry.id].row < entry.relativeRows[entry.id].row)) {
				const absRow = e.relativeRows[entry.id].row*1 + diff*1;
				const moved = this._freePosition(absRow, e);
				console.log(moved);
			}
			
			//Finally, the rows after
			for (const e of entry.cluster.filter(e => e.relativeRows[entry.id].row > entry.relativeRows[entry.id].row)) {
				const absRow = e.relativeRows[entry.id].row*1 + diff*1;
				const moved = this._freePosition(absRow, e);
				console.log(moved);
			}
			
			this._adjustCluster(entry);
			
			//The GridCheck object sends the first row for the grid, not the master row we've been working from
			row = row - entry.relativeRows[entry.id].row;
			
			return { fit: true, row: row, count: entry.grid.length }
		}
		
		/**
		 * Force an empty row at the specified index into the grid.
		 * @param {number} row
		 * @param {DiagramGrid} grid
		 * @return {number}
		 */
		_forceRelatedRow(row, grid) {
			grid = grid.splice(row, 0, new Array(this._xLength).fill(false));
			return row;
		}
		
		/**
		 * Check the rows assigned for the entry's cluster, and see if a space closer to their preferred target is free.
		 * @param {DiagramEntry} entry
		 */
		_adjustCluster(entry) {
			for (const e of entry.cluster.filter(e => e !== entry.id)) {
				//Check if the entry would prefer to be moved up
				const r = this._findBetterRelativePosition(e, entry.id);
				if (r) {
					console.log(`Moving ${e.id} to ${r}.`);
					this._assignRow(r, e);
				} else {
					console.log(`No better place for ${e.id}`);
				}
			}
		}
		
		/**
		 * Return a new row for the given entry if a preferable one in relation to all of its clusters is available.
		 * @param {DiagramEntry} entry
		 * @return {number|false}
		 */
		_findBetterRelativePosition(entry) {
			let preference = 0;
			if (!entry.row) return false;
			for (const key in entry.relativeRows) {
				const target = this._findEntriesByValue("id", key)[0];
				if (target.row) {
					console.log(`${entry.id} would like to be at ${target.row + entry.relativeRows[key].relative}`);
					preference += (target.row + entry.relativeRows[key].relative) - entry.row;
				}
			}
			console.log(`${entry.id} is at ${entry.row}; preference: ${preference}`);
			
			const r = this._checkGridRange(
				this._yearToGrid(entry.start),
				this._yearToGrid(entry.end),
				(preference > 0 ? entry.row : entry.row + preference),
				(preference > 0 ? entry.row + preference : entry.row)
			);
			return r;
		}
		
		/**
		 * ***********************************************************************************************
		 * Grid querying functions.
		 */
		
		/**
		 * Check if grid1 can be fit into grid2.
		 * If row is defined, check only if grid1 can be set at that y position in grid2.
		 * If row isn't defined, check anywhere.
		 * @param {DiagramGrid} grid1
		 * @param {DiagramGrid} grid2
		 * @param {number} [row = null] If defined, check 
		 * @return {GridCheck}
		 */
		_checkFitInGrid(grid1, grid2, row = null) {
			let count = 0;
			const requested = row;
			let log = [];
			
			if (row !== null) {
				if (this._compareGridRows(grid1[0], grid2[row])) {
					count = 1;
					
					for (let j = 1; j < grid1.length; j++) {
						if (!grid2[row+j]) break;
						if (!this._compareGridRows(grid1[j], grid2[row+j])) break;
						count += 1;
					}
					return { fit: count === grid1.length, row: row, count: count, requested: requested, log: log }
				}
			}
			
			//Find a space in grid2 for the first row of grid1.
			//If found, loop through the subsequent rows and see if they can be fit below the space found.
			//If not, find the next space and try again.
			for (const [i, r] of grid2.entries()) {
				if (this._compareGridRows(grid1[0], r)) {
					row = i;
					count = 1;
					for (let j = 1; j < grid1.length && j + row < grid2.length; j++) {
						const valid = this._compareGridRows(grid1[j], grid2[row+j]);
						if (valid) log.push(`${j}: Fit ok for row ${row+j}`);
						if (!valid) break;
						count += 1;
					}
					return { fit: count === grid1.length, row: row, count: count, requested: requested }
				}
			}
			return { fit: false, row: null, count: 0, requested: requested }
		}
		
		/**
		 * Check if the two grid rows can be fit together without any clashes in used space.
		 * @param {GridRow} row1
		 * @param {GridRow} row2
		 * @return {boolean}
		 */
		_compareGridRows(row1, row2) {
			for (const [i, e] of row1.entries()) {
				if (e && row2[i]) {
					return false;
				}
			}
			return true;
		}
		
		/**
		 * Check the given grid range for a space between x1 and x2 on a row between y1 and y2.
		 * If y1 and y2 are unspecified, all rows are checked.
		 * @param {number} x1
		 * @param {number} x2
		 * @param {number} [y1 = 0]
		 * @param {number} [y2 = grid.length-1]
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {number|false}
		 */
		_checkGridRange(x1, x2, y1 = 0, y2 = null, grid = this._grid) {
			if (y2 === null) y2 = grid.length -1;
			for (let i = y1; i <= y2; i++) {
				if (this._checkGridRow(i, x1, x2, grid)) return i;
			}
			return false;
		}
		
		/**
		 * Check if the specified row y is free between x1 and x2.
		 * Defaults to the master grid, if grid isn't specified.
		 * @param {number} y
		 * @param {number} x1
		 * @param {number} x2
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {boolean}
		 */
		_checkGridRow(y, x1, x2, grid = this._grid) {
			//In most instances, we don't want to extend to the end of the "end" year, but to the start. So that, e.g. we can join with another entry starting on that year and not overlap.  However, entries with the same start and end must take up some space.
			if (x1 === x2) {
				x2 += 1;
			}
			if (grid[y] === undefined) {
				throw new Error(`Invalid row checked. ${y} ${x1} ${x2}. Highest row: ${grid.length -1}`);
			}
			if (x2 > grid[y].length -1 || x1 < 0) {
				throw new Error(`Invalid range checked. ${y} ${x1} ${x2}. Available range is: 0 - ${grid[y].length -1}`);
			}
			
			const part = grid[y].slice(x1, x2);
			return part.every( e => e === false);
		}
		
		/**
		 * @return {number}
		 */
		get rows() {
			return this._grid.length;
		}
		
		/**
		 * Grid modification functions.
		 */
		
		/**
		 * Create a grid for the provided array of entries.
		 * If any entries have a row already set, the grid will account for those
		 * @param {DiagramEntry[]} entries
		 * @return {DiagramGrid}
		 */
		_createGrid(entries) {
			const setRows = entries.filter(e => e.row);
			const rows = ( setRows.length > 0 ? Math.max(...setRows.map(e => e.row)) + 1 : 1 );
			let grid = Array.from(Array(rows), () => new Array(this._xLength).fill(false));
			for (const entry of setRows) {
				grid = this._blockGridRow(entry.row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), grid);
			}
			return grid;
		}
		
		/**
		 * Take a grid and remove all empty rows until a used row is met.
		 * @param {DiagramGrid} grid
		 * @return {DiagramGrid}
		 */
		_makeGridRelative(grid) {
			let r = 0;
			while(r < grid.length - 1 && this._checkGridRow(r, 0, grid[0].length - 1, grid)) {
				r++;
			}
			grid = grid.slice(r);
			return grid;
		}
		
		/**
		 * @param {DiagramGrid} grid
		 * @return {string}
		 */
		_gridString(grid) {
			return JSON.stringify(grid.map(e => e.filter(e => e).length));
		}
		
		/**
		 * @param {number} y
		 * @param {number} x1
		 * @param {number} x2
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {DiagramGrid}
		 */
		_blockGridRow(y, x1, x2, grid = this._grid) {
			this._markGridRow(y, x1, x2, true, grid);
			return grid;
		}
		
		/**
		 * @param {number} y
		 * @param {number} x1
		 * @param {number} x2
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {DiagramGrid}
		 */
		_freeGridRow(y, x1, x2, grid = this._grid) {
			this._markGridRow(y, x1, x2, false, grid);
			return grid;
		}
		
		/**
		 * @param {number} y
		 * @param {number} x1
		 * @param {number} x2
		 * @param {boolean} state
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {DiagramGrid}
		 */
		_markGridRow(y, x1, x2, state, grid = this._grid) {
			if (!grid[y]) throw new Error(`Attempt to mark non-existent grid row ${y}`);
			if (x1 > grid[0].length -1 || x2 > grid[0].length -1) throw new Error(`X coords out of range: ${x1} ${x2}`);
			let n = 0;
			while (n < (x2 - x1)) {
	// 			console.log(`Setting grid[${y}][${x1+n}] to ${state}`);
				grid[y][x1+n] = state;
				n++;
			}
			
			//Mark space either end to keep entries from joining, if available
			if (x1 > 0) {
	// 			console.log(`Setting before block: grid[${y}][${x1-1}] to ${state}`);
				grid[y][x1-1] = state;
			}
			if (x2 < grid[y].length) {
	// 			console.log(`Setting after block: grid[${y}][${x2}] to ${state}`);
				grid[y][x2] = state;
			}
			return grid;
		}
		
		/**
		 * @param {DiagramGrid} grid
		 * @return {DiagramGrid}
		 */
		_addGridRow(grid = this._grid) {
			grid.push(new Array(this._xLength).fill(false));
			return grid;
		}
		
		/**
		 * Free the given row space for the given entry.
		 * Shifts other entries until the space is free and there are no clashes.
		 * @param {number} row 
		 * @param {DiagramEntry} entry
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {EntryID[]} An array of EntryIDs of other entries moved to create space
		 */
		_freePosition(row, entry, grid = this._grid) {
			let moved = Array();
			
			//Shouldn't be possible, but if the position is occupied already by this entry, return
			//TODO: See where that's coming from...
			if (entry.row == row) {
				console.log(`Requested to free row ${row} for ${entry.id} but it's already positioned there...`);
				return moved;
			}
			if (!this._checkGridRow(row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), grid)) {
				console.log(`Row ${row} not free for ${entry.id}. Shifting.`);
				//Move entries from the inserted row onwards, if they need to be moved.
				moved = this._shiftGridEntries(parseInt(row), this._yearToGrid(entry.start), this._yearToGrid(entry.end), grid);
			}
			return moved;
		}
		
		/**
		 * Shift any entries in the given grid space.
		 * By default, they are moved down 1 row.  If that space isn't free, the subsequent entries are moved, recursively.
		 * TODO: Check the entry's preferred distances from others and move upwards if appopriate.
		 * @param {number} row
		 * @param {number} x1
		 * @param {number} x2
		 * @param {DiagramGrid} grid
		 * @return {EntryID[]}
		 */
		_shiftGridEntries(row, x1, x2, grid) {
			
			let moved = Array();
			console.log(`Shift called with: ${row} ${x1} ${x2}`);
			const affected = this._entries.filter(e => e.row == row && this._yearToGrid(e.end) >= x1 && this._yearToGrid(e.start) <= x2);
			console.log("Entries affected:");
			console.log(affected);
			for (const entry of affected) {
				console.log(`${entry.id} affected by move at row ${row}`);
				const e1 = this._yearToGrid(entry.start);
				const e2 = this._yearToGrid(entry.end);
				
				//If we're on the bottom row, add another
				if (row*1 + 1 >= grid.length) {
					this._addGridRow(grid);
				}
				
				//Check the space before we move in to it.
				//The assignation occurs anyway, but this tells us if we need to continue.
				let free = false;
				if (this._checkGridRow(row*1 + 1, e1, e2, grid)) {
					free = true;
				}
				
				if (free === false) {
					console.log(`Space for ${entry.id} was blocked. Continuing...`);
					moved = moved.concat(this._shiftGridEntries(row*1 + 1, e1, e2, grid));
				}
				this._assignRow(entry.row*1 + 1, entry);
				moved.push(entry.id);
				console.log(`${entry.id} moving from ${entry.row*1 - 1} to ${entry.row}`);
			}
			return moved;
		}
		
		/**
		 * @param {number} row
		 * @param {number} count
		 * @param {DiagramGrid} [grid = this._grid]
		 * @return {DiagramGrid}
		 */
		_insertGridRow(row, grid = this._grid) {
			if (grid == this._grid) console.log(`Inserting row in master grid at ${row}`);
			try {
				grid.splice(row, 0, new Array(this._xLength).fill(false));
			} catch {
				throw new Error(`Bad row insert: ${row}, ${count}`);
			}
			return grid;
		}
		
		/**
		 * Convert a number representing a year to an X position on the diagram grid.
		 * @param {number} year
		 * @return {number}
		 */
		_yearToGrid(year) {
			if (isNaN(year)) throw new Error(`${year} is not a year. Cannot parse as number.`);
			return parseInt(year) - parseInt(this._yearStart);
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
	 * @typedef {object} DiagramConfig
	 * @property {number} [config.yearStart = 1900] - the starting year for the timeline
	 * @property {number} [config.yearEnd = Current year + 1] - the end year for the timeline
	 * @property {number} [config.strokeWidth = 4] - the width in px of the joining lines
	 * @property {number} [config.yearWidth = 50] - the width in px of diagram used to for each year
	 * @property {number} [config.rowHeight = 50] - the height in px of each diagram row
	 * @property {number} [config.padding = 5] - the padding in px between rows
	 * @property {string} [config.strokeColour = "#999"] - the default colour for lines drawn (must be a valid colour hex)
	 * @property {number} [config.boxWidth = 100] - the width in px of each entry
	 * @property {boolean} [config.guides = true] - whether to draw striped guides at regular intervals in the timeline
	 * @property {number} [config.guideInterval = 5] - the interval in years between guides (ignored if 'guides' is false)
	 * @property {string} [config.entrySelector = "div"] - the CSS selector to match entries
	 * @property {string} [config.linkDashes = "4"] - The svg dasharray for link lines.
	 * 			Must be a valid dasharray. See <https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray>
	 * @property {string} [config.irregularDashes = "20 2"] - The svg dasharray for entries marked as 'irregular' with the data-irregular attribute.
	 * 			Must be a valid dasharray. See <https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray>
	 * @property {number} [config.groupingThreshold = 8] - The tolerance for distance between grouped entries when automatically positioning
	 * 
	 */

	/**
	 * The default configuration object for the Diagram class
	 * @type DiagramConfig
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
		 * @param {string} [container] - The ID of the container element for the diagram.
		 * @param {DiagramConfig} [config] - Configuration object for the diagram. Entirely optional.
		 */
		constructor(container, config = {}) {
			this._config = this._makeConfig(config);
			
			
			this._container = document.getElementById(container);
			this._entries = this._container.querySelectorAll("#" + container + " > " + this._config.entrySelector + ":not(.timeline-exclude)");
			
			this._prepareEntries();
		}
		
		/**
		 * Prepare all entries with additional inferred data attributes.
		 * @protected
		 */
		_prepareEntries() {
			let i = 1;
			for (const entry of this._entries) {
				
				//Set IDs on blocks for convenience
				if (entry.classList.contains("timeline-block")) {
					entry.id = "block-" + i;
					entry.dataset.block = true;
					i++;
				} else {
					entry.classList.add("entry");
					entry.dataset.entry = true;
				}

				//Start with either current or default, then modify if needed below
				entry.dataset.end = ( entry.dataset.end ? entry.dataset.end : this._config.yearEnd );
				if (entry.dataset.become) {
					entry.dataset.end = parseInt(document.getElementById(entry.dataset.become).dataset.start);
				}			
	// 			entry.dataset.xLength = parseInt(entry.dataset.end) - parseInt(entry.dataset.start);
			}
		}
		
		/**
		 * Take the given config, apply defaults and return final config object.
		 * @protected
		 * @param {DiagramConfig} config
		 * @return {DiagramConfig}
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
			
		/** 
		 * Create the timeline.
		 * This should be called after instantiating a Diagram.
		 * @public
		 * @return {HTMLElement}
		 */
		create() {
			this._positioner = new DiagramPositioner(this._entries, this._config.yearStart, this._config.yearEnd);
			this._setConfigProp("rows", this._positioner.rows);
			this._setupCSS();
			this._draw();
			this._addDates();
			if (this._config.guides === true) {
				this._addGuides();
			}
			return this._container;
		}
		
		/** 
		 * Setup CSS classes and data for entries and apply root CSS vars.
		 * Note: config.rows must be set first (i.e. if using DiagramPositioner, the calculation has to be finished.)
		 * @protected
		 */
		_setupCSS() {
			
			const root = document.documentElement;
			root.style.setProperty('--timeline-year-width', this._config.yearWidth + "px");
			root.style.setProperty('--timeline-row-height', this._config.rowHeight + "px");
			root.style.setProperty('--timeline-box-width', this._config.boxWidth + "px");
			root.style.setProperty('--timeline-box-height', this._config.boxHeight + "px");
			root.style.setProperty('--timeline-box-width-min', this._config.boxHeight + "px");
			root.style.setProperty('--timeline-padding', this._config.padding + "px");
			root.style.setProperty('--timeline-stroke-colour', this._config.strokeColour);
			
			//Set up container
			this._container.classList.add("timeline-container");
			this._container.style.height = (this._config.rows + 2) * this._config.rowHeight + "px"; //Add 2 rows to total for top and bottom space
			this._container.style.width = (this._config.yearEnd + 1 - this._config.yearStart) * this._config.yearWidth + "px"; //Add 1 year for padding
		
			this._setEntriesPosition();
		}
		
		/**
		 * Set styles for each entry to position them according to calculated row and entry size
		 * @protected
		 */
		_setEntriesPosition() {
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
			for (const entry of [...this._entries].filter(e => e.dataset.become)) {
				const become = document.getElementById(entry.dataset.become);
				
				if (entry.dataset.start == become.dataset.start) {
					entry.style.left = parseInt(entry.style.left) - this._config.boxMinWidth/2 + "px";
					become.style.left = parseInt(become.style.left) + this._config.boxMinWidth/2 + "px";
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
			for (const entry of [...this._entries].filter(e => !e.classList.contains("timeline-block"))) {
				const colour = (entry.dataset.colour ? entry.dataset.colour : this._config.strokeColour);
				const dasharray = (entry.dataset.irregular == "true" ? this._config.irregularDashes : "");
				
				if(!entry.id) throw new Error (`Missing id on ${entry.text}`);
				try {
					this._yearToWidth(entry.dataset.end);
				} catch {
					console.log(`${entry.id} error on draw - bad end year`);
				}
				
				let endMarker = "";
				let cssClass = "end";
				let start = this._getJoinCoords(entry.id, "right");
				let end = {
					x: this._yearToWidth(entry.dataset.end),
					y: start.y
				};
				
				//Ends without joining another entry
				if (!entry.dataset.merge &&
					!entry.dataset.become
				) {
					endMarker = (entry.dataset.endEstimate ? "dots" : "circle");
				}
				
				if (entry.dataset.become) { 
					end = this._getJoinCoords(entry.dataset.become, 'left');
					cssClass = "become";
				}
				
				if (entry.dataset.merge) {
					//Special case of one year length and then merging. We need to bump the merge point forward by 1 year to meet an 'end of year' point. Otherwise, it's indistinguishable from a split.
					if (entry.dataset.start == entry.dataset.end) {
						end.x += this._config.yearWidth;
					}
					
					const mergePoint = {
						x: end.x,
						y: this._getYCentre(entry.dataset.merge)
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

				if (entry.dataset.split) {
					this._drawSplit(entry, colour);
				}
				if (entry.dataset.links) {
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
				y: this._getYCentre(source.id)
			};
			
			//Special case - if the split occurs when the former entry ends.
			if (source.dataset.end <= entry.dataset.start) {
				console.log(`Former start ${start.x}`);
				start.x = start.x - this._config.yearWidth;
				console.log(`New start ${start.x}`);
				direction = "left";
			}
			
			const end = this._getJoinCoords(entry.id, direction);
			
			const line = SvgConnector.draw( { start: start, end: end, stroke: this._config.strokeWidth, colour: colour });
			
			line.classList.add("split");
			this._container.append(line);
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
					indices["right"] = indices["right"] + 1;
					sourceSide = "right";
					targetSide = "left";
				}
				if (eRow === tRow && entry.dataset.start > target.dataset.start) {
					indices["left"] = indices["left"] + 1;
					sourceSide = "left";
					targetSide = "right";
				}
				if (eRow > tRow) {
					indices["top"] = indices["top"] + 1;
					sourceSide = "top";
					targetSide = "bottom";
				}
				if (eRow < tRow) {
					indices["bottom"] = indices["bottom"] + 1;
					sourceSide = "bottom";
					targetSide = "top";
				}
				
				start = this._getJoinCoords(entry.id, sourceSide, indices[sourceSide]);
				
				//Start with vertical line to line case
				end = {
					x: start.x,
					y: this._getYCentre(target.id)
				};
				
				//If the target doesn't overlap in time with the source (can't be after, as link would be vice versa then)
				if(entry.dataset.start >= target.dataset.end) {
					end.x = this._yearToWidth(target.dataset.end);
				}
				
				//If the year is the same, link the entry box, not the line
				if(entry.dataset.start == target.dataset.start) {
					end = this._getJoinCoords(target.id, targetSide);
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
			
		/**
		 * Check if an entry should be small on the graph (too brief to fit full box size)
		 * @protected
		 * @param {HTMLElement} entry
		 * @return {boolean}
		 */
		_checkSmallEntry(entry) {
			//Entries which start and end in the same year should have a length of 1
			const length = ( (entry.dataset.end - entry.dataset.start) > 0 ? entry.dataset.end - entry.dataset.start : 1 );
			
			if (length < (this._config.boxWidth/this._config.yearWidth)) {
				return true;
			} else {
				return false;
			}
		}
		
		/**
		 * Get the X-axis centre of the element with the given ID.
		 * @protected
		 * @param {string} id
		 * @return {number}
		 */
		_getXCentre(id) {
			const node = document.getElementById(id);
			return parseFloat(node.style.left) + (this._config.boxWidth/2);
		}
		
		/**
		 * Get the Y-axis centre of the element with the given ID.
		 * @protected
		 * @param {string} id
		 * @return {number}
		 */
		_getYCentre(id) {
			const node = document.getElementById(id);
			if (node == null) { console.log(`ID:${id} got null node.`); }
			return parseFloat(node.style.top) + (this._config.boxHeight/2);
		}
		
		/**
		 * Get co-ordinates at which to join a line to the element based on the preferred side.
		 * An offset can be supplied. This will move the returned co-ords to accomodate other lines linking to the same side.
		 * @param {string} id
		 * @param {("left"|"right"|"top"|"bottom")} side
		 * @param {number} [offset] - The number of positions offset the returned co-ordinates should be
		 * @return {{x: number, y: number}}
		 */
		_getJoinCoords(id, side, offset = 0) {
			const offsetIncrement = 5;
			const node = document.getElementById(id);
			const status = window.getComputedStyle(node);
			
			const l = parseFloat(node.style.left);
			const t = parseFloat(node.style.top);
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
					throw `Invalid element side specified: Called with ${side}. Entry: ${id}`;
			}
		}
			
		/**
		 * Get the width in px of the diagram at the point sepecified by a particular year.
		 * @protected
		 * @param {number} year
		 * @return {number}
		 */
		_yearToWidth(year) {
			if (isNaN(year)) throw new Error(`Non-numerical year value received: ${year}`);
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
	 * @typedef {import('./Diagram.js').DiagramConfig | TimelineConfig} FullConfig
	 * 
	 * @typedef {object} TimelineConfig
	 * @property {boolean} [config.panzoom = false] - Whether to apply panning and zooming feature to the timeline.
	 * @property {string} [config.findForm = timeline-find] - The ID of the find form
	 * @property {string} [config.zoomIn = timeline-zoom-in] - The ID of the button to zoom in
	 * @property {string} [config.zoomOut = timeline-zoom-out] - The ID of the button to zoom out
	 * @property {string} [config.zoomReset = timeline-zoom-reset] - The ID of the button to reset the zoom level
	 */

	/**
	 * The default configuration object for the Timeline
	 * @type {TimelineConfig}
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
	 * @public
	 */
	class Timeline {
		/**
		 * @param {string} [container = diagram] - The ID of the container element for the timeline.
		 * @param {FullConfig} [config] - All config for the timeline
		 */
		constructor(container = "diagram", config = {}) {
			this._container = container;
			this._setConfig(config);
		}
		
		/**
		 * Create the Timeline. This should be called after instantiation.
		 * @public
		 */
		create() {
			const d = new Diagram(this._container, this._diagramConfig);
			this._diagram = d.create();

			if (this._config.panzoom === true) {
				this._initPanzoom();
				this._initControls();
				window.addEventListener('hashchange', () => this._hashHandler());
			}
			if (location.hash) {
				setTimeout(() => {
					this._hashHandler();
				});
			}
		}
		
		/**
		 * Take the provided config, separate config for the Diagram drawing class,
		 * and add in defaults for undefined properties.
		 * @private
		 * @param {FullConfig} config
		 */
		_setConfig(config) {
			/**
			 * @type {TimelineConfig}
			 */
			this._config = applyConfig(defaultTimelineConfig, config);
			
			/**
			 * @type {DiagramConfig}
			 */
			this._diagramConfig = applyConfig(defaultDiagramConfig, config);
		}
		
		/**
		 * If Panzoom is enabled, pan to the element with the given ID, and reset the zoom.
		 * @public
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
		 * @param {HTMLElement} form
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
		 * Add entries to the filtered entries container <ul> element, filtered by the value of the event-triggering input.
		 * @private
		 * @param {Event} e
		 */
		_showEntryOptions(e) {
			const val = e.target.value;
			if (val.trim() === "") {
				this._findConfig.results.innerHTML = "";
				return;
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
		 * @typedef {{ id: string, name: string }} EntrySearch
		 */
		
		/**
		 * Filter the list of entries to match the provided search string.
		 * @private
		 * @param {string} search
		 * @return {EntrySearch[]}
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
		 * @param {Event} e
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
		 * @param {Event} e
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
		 */
		_hashHandler() {
			const id = location.hash.replace('#find-', '');
			if(document.getElementById(id) && this._pz) this.panToEntry(id);
		}
	}

	return Timeline;

}));
