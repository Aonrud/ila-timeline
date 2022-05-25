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
 * @module Timeline
 */
import {defaultDiagramConfig, Diagram} from './Diagram.js';
import {applyConfig} from './util.js';

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
}

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
		
		setTimeout( () => { target.classList.add("highlight", "hover") }, 500);	
		setTimeout( () => { target.classList.remove("highlight", "hover") }, 2000);
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
		
		if(zoomIn) { zoomIn.addEventListener("click", this._pz.zoomIn) }
		if(zoomOut) { zoomOut.addEventListener("click", this._pz.zoomOut) }
		if(reset) { reset.addEventListener("click", () => this._pz.zoom(1)) }
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
			
		}
		this._findConfig = findConfig;
		
		//Stop refresh keeping a previous value (which won't be valid without corresponding ID)
		findConfig.finder.value = "";
		
		form.addEventListener('input', (e) => this._showEntryOptions(e));
		form.addEventListener('submit', (e) => this._findSubmit(e))
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
		const name = e.target.querySelector("input[name=finder]").value;
		
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
				event.preventDefault()
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

export default Timeline;

