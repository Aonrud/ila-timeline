import SvgConnector from './SvgConnector.js';
import DiagramPositioner from './DiagramPositioner.js';
import {applyConfig} from './util.js';

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
}

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
		this._entries = document.querySelectorAll("#" + container + " > " + this._config.entrySelector+":not(.timeline-exclude)");
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
		this._prepareRows();
		
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
	 * Set the row for all entries, using automatic diagramPositioner if available
	 * @protected
	 */
	_prepareRows() {
		let rows = 1;
		
		//Find the highest manual row number
		for (const entry of this._entries) {
			if (parseInt(entry.dataset.row) > rows) {
				rows = parseInt(entry.dataset.row);
			}
		}

		//If we are using the positioner only (otherwise must be manually set)
		if (typeof DiagramPositioner === "function") {
			const years = this._config.yearEnd - this._config.yearStart;
			const dp = new DiagramPositioner(years, this._config.yearStart, rows);
			
			for (const entry of this._entries) {
				dp.setEntryRow(entry);
			}
			rows = dp.rows;
		}
		this._setConfigProp("rows", rows);
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
				}
				
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
		}
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
		}
		const end1 = {
			x: this._yearToWidth(forkYear+1),
			y: this._getYCentre(document.getElementById(forks[0]))
		}
		const end2 = {
			x: this._yearToWidth(forkYear+1),
			y: this._getYCentre(document.getElementById(forks[1]))
		}
		
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
		}
		
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
			}
			
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
				break;
			case 'right':
				return {
					x: l + w,
					y: t + h/2 + (offset * offsetIncrement)
				};
				break;
			case 'top':
				return {
					x: l + w/2 + (offset * offsetIncrement),
					y: t
				};
				break;
			case 'bottom':
				return {
					x: l + w/2 + (offset * offsetIncrement),
					y: t + h
				};
				break;
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

export {defaultDiagramConfig, Diagram}
