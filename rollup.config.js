//import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import header from './src/license-header.js';

export default {
	input: 'src/Timeline.js',
	output: [
		{
			name: 'Timeline',
			file: 'dist/timeline.js',
			format: 'umd',
			banner: header
		},
		{
			name: 'Timeline',
			file: 'dist/timeline.min.js',
			format: 'umd',
			plugins: [terser( { 
				mangle: { properties: { regex: /^_/ } },
				format: { comments: `/^\/*!/` }
			} )],
			banner: header
		},
		{
			name: 'Timeline',
			file: 'dist/timeline.esm.js',
			format: 'esm',
			banner: header
		}
	]
}
