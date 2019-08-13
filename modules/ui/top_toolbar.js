
import {
    select as d3_select
} from 'd3-selection';
import { t } from '../util/locale';
import { utilFunctor } from '../util/util';
import { modeBrowse } from '../modes/browse';
import _debounce from 'lodash-es/debounce';
import { operationCircularize, operationContinue, operationDelete, operationDisconnect,
    operationDowngrade, operationExtract, operationMerge, operationOrthogonalize,
    operationReverse, operationSplit, operationStraighten } from '../operations';
import { uiToolAddFavorite, uiToolAddRecent, uiToolNotes, uiToolOperation, uiToolSave, uiToolAddFeature, uiToolUndoRedo } from './tools';
import { uiToolSimpleButton } from './tools/simple_button';
import { uiToolWaySegments } from './tools/way_segments';
import { uiToolRepeatAdd } from './tools/repeat_add';
import { uiToolStructure } from './tools/structure';
import { uiToolCenterZoom } from './tools/center_zoom';
import { uiToolStopDraw } from './tools/stop_draw';

export function uiTopToolbar(context) {

    var circularize = uiToolOperation(context, operationCircularize),
        continueTool = uiToolOperation(context, operationContinue),
        deleteTool = uiToolOperation(context, operationDelete),
        disconnect = uiToolOperation(context, operationDisconnect),
        downgrade = uiToolOperation(context, operationDowngrade),
        extract = uiToolOperation(context, operationExtract),
        merge = uiToolOperation(context, operationMerge),
        orthogonalize = uiToolOperation(context, operationOrthogonalize),
        reverse = uiToolOperation(context, operationReverse),
        split = uiToolOperation(context, operationSplit),
        straighten = uiToolOperation(context, operationStraighten);

    var addFeature = uiToolAddFeature(context),
        addFavorite = uiToolAddFavorite(context),
        addRecent = uiToolAddRecent(context),
        notes = uiToolNotes(context),
        undoRedo = uiToolUndoRedo(context),
        save = uiToolSave(context),
        waySegments = uiToolWaySegments(context),
        structure = uiToolStructure(context),
        repeatAdd = uiToolRepeatAdd(context),
        centerZoom = uiToolCenterZoom(context),
        stopDraw = uiToolStopDraw(context),
        deselect = uiToolSimpleButton({
            id: 'deselect',
            label: t('toolbar.deselect.title'),
            iconName: 'iD-icon-close',
            onClick: function() {
                context.enter(modeBrowse(context));
            },
            tooltipKey: 'Esc'
        }),
        cancelSave = uiToolSimpleButton({
            id: 'cancel',
            label: t('confirm.cancel'),
            iconName: 'iD-icon-close',
            onClick: function() {
                context.enter(modeBrowse(context));
            },
            tooltipKey: 'Esc',
            available: function() {
                return context.mode().id === 'save';
            }
        });

    function allowedTools() {

        var mode = context.mode();
        if (!mode) return [];

        var tools;

        if (mode.id === 'save') {

            tools = [
                cancelSave,
                'spacer'
            ];

        } else if (mode.id === 'select' &&
            !mode.newFeature() &&
            mode.selectedIDs().every(function(id) {
                return context.graph().hasEntity(id);
            })) {

            tools = [
                deselect,
                'spacer',
                centerZoom,
                'spacer',
                circularize,
                continueTool,
                disconnect,
                extract,
                merge,
                orthogonalize,
                reverse,
                split,
                straighten,
                'spacer',
                downgrade,
                deleteTool,
                'spacer',
                undoRedo,
                save
            ];

        } else if (mode.id === 'add-point' || mode.id === 'add-line' || mode.id === 'add-area' ||
            mode.id === 'draw-line' || mode.id === 'draw-area') {

            tools = [
                'spacer',
                structure,
                'spacer',
                waySegments,
                'spacer',
                repeatAdd,
                undoRedo,
                stopDraw
            ];

        } else {

            tools = [
                'spacer',
                centerZoom,
                'spacer',
                addFeature,
                addFavorite,
                addRecent,
                'spacer',
                notes,
                'spacer',
                undoRedo,
                save
            ];
        }

        tools = tools.filter(function(tool) {
            return !tool.available || tool.available();
        });

        var deduplicatedTools = [];
        // remove adjacent duplicates (i.e. spacers)
        tools.forEach(function(tool) {
            if (!deduplicatedTools.length || deduplicatedTools[deduplicatedTools.length - 1] !== tool) {
                deduplicatedTools.push(tool);
            }
        });

        return deduplicatedTools;
    }

    function topToolbar(bar) {

        var debouncedUpdate = _debounce(update, 250, { leading: true, trailing: true });
        context.history()
            .on('change.topToolbar', debouncedUpdate);
        context.layers()
            .on('change.topToolbar', debouncedUpdate);
        context.map()
            .on('move.topToolbar', debouncedUpdate)
            .on('drawn.topToolbar', debouncedUpdate);

        context.on('enter.topToolbar', update);

        context.presets()
            .on('favoritePreset.topToolbar', update)
            .on('recentsChange.topToolbar', update);


        update();

        function update() {

            var tools = allowedTools();

            var toolbarItems = bar.selectAll('.toolbar-item')
                .data(tools, function(d) {
                    return d.id || d;
                });

            toolbarItems.exit()
                .each(function(d) {
                    if (d.uninstall) {
                        d.uninstall();
                    }
                })
                .remove();

            var itemsEnter = toolbarItems
                .enter()
                .each(function(d) {
                    if (d.install) {
                        d.install();
                    }
                })
                .append('div')
                .attr('class', function(d) {
                    var classes = 'toolbar-item ' + (d.id || d).replace('_', '-');
                    if (d.itemClass) classes += ' ' + d.itemClass;
                    return classes;
                });

            var actionableItems = itemsEnter.filter(function(d) { return typeof d !== 'string'; });

            actionableItems
                .append('div')
                .attr('class', function(d) {
                    var classes = 'item-content';
                    if (d.contentClass) classes += ' ' + d.contentClass;
                    return classes;
                });

            actionableItems
                .append('div')
                .attr('class', 'item-label');

            toolbarItems = toolbarItems.merge(itemsEnter)
                .each(function(d){
                    if (d.render) d3_select(this).select('.item-content').call(d.render, bar);
                });

            toolbarItems.selectAll('.item-label')
                .text(function(d) {
                    return utilFunctor(d.label)();
                });
        }

    }

    return topToolbar;
}
