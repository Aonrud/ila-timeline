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
 * @property {string} [group]
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
		
		//TODO: Alternate top and bottom - insert preceding rows where needed.
		let above = true;
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
			rel[entry.id] = { "row": c.rowTemp, "relative": c.rowTemp - entry.rowTemp}
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
		//Dataset properties we're interested in - others can be ignored.
		const props = [ "start", "end", "become", "split", "merge", "links", "row", "group" ];
		
		let entries = [...nodes].map( e => { 
			let o = { "id": e.id };
			for (const d in e.dataset) {
				if (!props.includes(d)) continue;
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
		cluster = cluster.concat(this._findEntriesByValue("id", entry.merge, entries).filter( e => e.start == entry.end))
		
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
		let result = []
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
			this._freeGridRow(entry.row, this._yearToGrid(entry.start), this._yearToGrid(entry.end), this._grid)
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
		if (log) console.log(`Cluster grid: ${this._gridString(entry.grid)}`)
		if (log) console.log(`Master grid: ${this._gridString(this._grid)}`)
		
		//If the master grid is too small, expand it
		while (this._grid.length < entry.grid.length) {
			this._grid = this._addGridRow();
		}
				
		//If some entries already have a row set, then we don't need to look in the master grid for that space.
		for(const a of entry.cluster.filter(b => b.row)) {
			this._freeGridRow(a.relativeRows[entry.id].row, this._yearToGrid(a.start), this._yearToGrid(a.end), entry.grid);
		}
		
		const position = (entry.row ? entry.row - entry.relativeRows[entry.id].row : null)
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

export default DiagramPositioner
