import SvgConnector from './SvgConnector.js';
import DiagramPositioner from './DiagramPositioner.js';
import {applyConfig} from './util.js';

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
}

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
			if (entry.dataset.fork) {
				const forks = entry.dataset.fork.split(" ");
				entry.dataset.end = Math.max(document.getElementById(forks[0]).dataset.start, document.getElementById(forks[1]).dataset.start);
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
				this._yearToWidth(entry.dataset.end)
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
				!entry.dataset.fork &&
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

			if (entry.dataset.split) {
				this._drawSplit(entry, colour);
			}
			if (entry.dataset.fork) {
 				this._drawForks(entry, colour);
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
		}
		const end = this._getJoinCoords(entry.id, direction);
		
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
			y: this._getYCentre(entry.id)
		}
		const end1 = {
			x: this._yearToWidth(forkYear+1),
			y: this._getYCentre(forks[0])
		}
		const end2 = {
			x: this._yearToWidth(forkYear+1),
			y: this._getYCentre(forks[1])
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
			}
			
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
		if (node == null) { console.log(`ID:${id} got null node.`) }
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

export {defaultDiagramConfig, Diagram}
