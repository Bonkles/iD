import { uiToolSegemented } from './segmented';
import { t } from '../../util/locale';

export function uiToolWaySegments(context) {

    var tool = uiToolSegemented(context);

    tool.id = 'way_segments';
    tool.label = t('toolbar.segments.title');
    tool.key = t('toolbar.segments.key');

    tool.items = [
        {
            id: 'straight',
            icon: 'iD-segment-straight',
            label: t('toolbar.segments.straight.title')
        },
        {
            id: 'orthogonal',
            icon: 'iD-segment-orthogonal',
            label: t('toolbar.segments.orthogonal.title')
        }
    ];

    tool.chooseItem = function(item) {
        context.storage('line-segments', item.id);
    };

    tool.activeItem = function() {
        var id = context.storage('line-segments') || 'straight';
        return tool.items.filter(function(d) { return d.id === id; })[0];
    };

    tool.available = function() {
        var mode = context.mode();
        return mode.id.indexOf('line') !== -1 || mode.id.indexOf('area') !== -1;
    };

    return tool;
}
