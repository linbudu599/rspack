import {
	RawCacheGroupOptions,
	RawModuleRule,
	RawRuleSetCondition,
	RawRuleSetLogicalConditions,
	RawOptions
} from "@rspack/binding";
import assert from "assert";
import { normalizeStatsPreset } from "../stats";
import { isNil } from "../util";
import {
	EntryNormalized,
	Experiments,
	Externals,
	ModuleOptionsNormalized,
	Node,
	Optimization,
	OptimizationSplitChunksOptions,
	OutputNormalized,
	RspackOptionsNormalized,
	RuleSetCondition,
	RuleSetLogicalConditions,
	RuleSetRule,
	SnapshotOptions,
	Target
} from "./types";
import * as oldBuiltins from "./builtins";
import {
	ComposeJsUseOptions,
	createRawModuleRuleUses
} from "./adapter-rule-use";
import { Compiler } from "../compiler";

export const getRawOptions = (
	options: RspackOptionsNormalized,
	compiler: Compiler
): RawOptions => {
	assert(
		!isNil(options.context) && !isNil(options.devtool) && !isNil(options.cache),
		"context, devtool, cache should not be nil after defaults"
	);
	const devtool = options.devtool === false ? "" : options.devtool;
	return {
		entry: getRawEntry(options.entry),
		mode: options.mode,
		target: getRawTarget(options.target),
		context: options.context,
		output: getRawOutput(options.output),
		resolve: options.resolve,
		module: getRawModule(options.module, {
			compiler,
			devtool,
			context: options.context
		}),
		externals: options.externals ? getRawExternals(options.externals) : {},
		externalsType:
			options.externalsType === undefined ? "" : options.externalsType,
		devtool,
		optimization: getRawOptimization(options.optimization),
		stats: { colors: normalizeStatsPreset(options.stats).colors ?? false },
		devServer: {
			hot: options.devServer?.hot ?? false
		},
		snapshot: getRawSnapshotOptions(options.snapshot),
		cache: {
			type: options.cache ? "memory" : "disable",
			// TODO: implement below cache options
			maxGenerations: 0,
			maxAge: 0,
			profile: false,
			buildDependencies: [],
			cacheDirectory: "",
			cacheLocation: "",
			name: "",
			version: ""
		},
		experiments: getRawExperiments(options.experiments),
		node: getRawNode(options.node),
		// TODO: refactor builtins
		builtins: options.builtins as any
	};
};

function getRawEntry(entry: EntryNormalized): RawOptions["entry"] {
	const raw: RawOptions["entry"] = {};
	for (const key of Object.keys(entry)) {
		const runtime = entry[key].runtime;
		raw[key] = {
			import: entry[key].import!,
			runtime: runtime === false ? undefined : runtime
		};
	}
	return raw;
}

function getRawTarget(target: Target | undefined): RawOptions["target"] {
	if (!target) {
		return [];
	}
	if (typeof target === "string") {
		return [target];
	}
	return target;
}

function getRawOutput(output: OutputNormalized): RawOptions["output"] {
	assert(
		!isNil(output.path) &&
			!isNil(output.publicPath) &&
			!isNil(output.assetModuleFilename) &&
			!isNil(output.filename) &&
			!isNil(output.chunkFilename) &&
			!isNil(output.cssFilename) &&
			!isNil(output.cssChunkFilename) &&
			!isNil(output.uniqueName) &&
			!isNil(output.strictModuleErrorHandling),
		"fields should not be nil after defaults"
	);
	return {
		path: output.path,
		publicPath: output.publicPath,
		assetModuleFilename: output.assetModuleFilename,
		filename: output.filename,
		chunkFilename: output.chunkFilename,
		cssFilename: output.cssFilename,
		cssChunkFilename: output.cssChunkFilename,
		uniqueName: output.uniqueName,
		library: output.library,
		strictModuleErrorHandling: output.strictModuleErrorHandling
	};
}

function getRawModule(
	module: ModuleOptionsNormalized,
	options: ComposeJsUseOptions
): RawOptions["module"] {
	assert(
		!isNil(module.defaultRules),
		"module.defaultRules should not be nil after defaults"
	);
	// TODO: workaround for module.defaultRules
	const rules = (
		[...module.defaultRules, ...module.rules] as RuleSetRule[]
	).map<RawModuleRule>(i => getRawModuleRule(i, options));
	return {
		rules,
		parser: module.parser
	};
}

const getRawModuleRule = (
	rule: RuleSetRule,
	options: ComposeJsUseOptions
): RawModuleRule => {
	return {
		test: rule.test ? getRawRuleSetCondition(rule.test) : undefined,
		include: rule.include ? getRawRuleSetCondition(rule.include) : undefined,
		exclude: rule.exclude ? getRawRuleSetCondition(rule.exclude) : undefined,
		resource: rule.resource ? getRawRuleSetCondition(rule.resource) : undefined,
		resourceQuery: rule.resourceQuery
			? getRawRuleSetCondition(rule.resourceQuery)
			: undefined,
		sideEffects: rule.sideEffects,
		use: createRawModuleRuleUses(rule.use ?? [], options),
		type: rule.type,
		parser: rule.parser,
		generator: rule.generator,
		resolve: rule.resolve,
		issuer: rule.issuer ? getRawRuleSetCondition(rule.issuer) : undefined,
		oneOf: rule.oneOf
			? rule.oneOf.map(i => getRawModuleRule(i, options))
			: undefined
	};
};

function getRawRuleSetCondition(
	condition: RuleSetCondition
): RawRuleSetCondition {
	if (typeof condition === "string") {
		return {
			type: "string",
			stringMatcher: condition
		};
	}
	if (condition instanceof RegExp) {
		return {
			type: "regexp",
			regexpMatcher: condition.source
		};
	}
	if (Array.isArray(condition)) {
		return {
			type: "array",
			arrayMatcher: condition.map(i => getRawRuleSetCondition(i))
		};
	}
	if (condition instanceof Object && condition !== null) {
		return {
			type: "logical",
			logicalMatcher: [getRawRuleSetLogicalConditions(condition)]
		};
	}
	throw new Error(
		"unreachable: condition should be one of string, RegExp, Array, Object"
	);
}

function getRawRuleSetLogicalConditions(
	logical: RuleSetLogicalConditions
): RawRuleSetLogicalConditions {
	return {
		and: logical.and
			? logical.and.map(i => getRawRuleSetCondition(i))
			: undefined,
		or: logical.or ? logical.or.map(i => getRawRuleSetCondition(i)) : undefined,
		not: logical.not ? getRawRuleSetCondition(logical.not) : undefined
	};
}

function getRawExternals(externals: Externals): RawOptions["externals"] {
	if (typeof externals === "string") {
		return {
			[externals]: externals
		};
	}
	return externals;
}

function getRawOptimization(
	optimization: Optimization
): RawOptions["optimization"] {
	assert(
		!isNil(optimization.moduleIds) &&
			!isNil(optimization.removeAvailableModules) &&
			!isNil(optimization.sideEffects),
		"optimization.moduleIds, optimization.removeAvailableModules, optimization.sideEffects should not be nil after defaults"
	);
	return {
		splitChunks: optimization.splitChunks
			? getRawSplitChunksOptions(optimization.splitChunks)
			: undefined,
		moduleIds: optimization.moduleIds,
		removeAvailableModules: optimization.removeAvailableModules,
		sideEffects: String(optimization.sideEffects)
	};
}

function getRawSplitChunksOptions(
	sc: OptimizationSplitChunksOptions
): RawOptions["optimization"]["splitChunks"] {
	return {
		cacheGroups: sc.cacheGroups
			? Object.fromEntries(
					Object.entries(sc.cacheGroups).map(([key, group]) => {
						let normalizedGroup: RawCacheGroupOptions = {
							test: group.test ? group.test.source : undefined,
							name: group.name,
							priority: group.priority,
							minChunks: group.minChunks,
							chunks: group.chunks
						};
						return [key, normalizedGroup];
					})
			  )
			: {},
		chunks: sc.chunks,
		maxAsyncRequests: sc.maxAsyncRequests,
		maxInitialRequests: sc.maxInitialRequests,
		minChunks: sc.minChunks,
		minSize: sc.minSize,
		enforceSizeThreshold: sc.enforceSizeThreshold,
		minRemainingSize: sc.minRemainingSize
	};
}

function getRawSnapshotOptions(
	snapshot: SnapshotOptions
): RawOptions["snapshot"] {
	const { resolve, module } = snapshot;
	assert(!isNil(resolve) && !isNil(module));
	const { timestamp: resolveTimestamp, hash: resolveHash } = resolve;
	const { timestamp: moduleTimestamp, hash: moduleHash } = module;
	assert(
		!isNil(resolveTimestamp) &&
			!isNil(resolveHash) &&
			!isNil(moduleTimestamp) &&
			!isNil(moduleHash)
	);
	return {
		resolve: {
			timestamp: resolveTimestamp,
			hash: resolveHash
		},
		module: {
			timestamp: moduleTimestamp,
			hash: moduleHash
		}
	};
}

function getRawExperiments(
	experiments: Experiments
): RawOptions["experiments"] {
	const { lazyCompilation, incrementalRebuild } = experiments;
	assert(!isNil(lazyCompilation) && !isNil(incrementalRebuild));
	return {
		lazyCompilation,
		incrementalRebuild
	};
}

function getRawNode(node: Node): RawOptions["node"] {
	assert(!isNil(node.__dirname));
	return {
		dirname: String(node.__dirname)
	};
}
