import { t } from '../util/locale';
import { modeDrawLine } from '../modes/draw_line';
import { operationDelete } from '../operations/delete';
import { utilDisplayLabel } from '../util';
import { osmRoutableHighwayTagValues } from '../osm/tags';
import { validationIssue, validationIssueFix } from '../core/validation';


export function validationDisconnectedWay() {
    var type = 'disconnected_way';

    function isTaggedAsHighway(entity) {
        return osmRoutableHighwayTagValues[entity.tags.highway];
    }

    function isNewRoad(entityId) {
        return entityId[0] === 'w' && entityId[1] === '-';
    }

    var validation = function checkDisconnectedWay(entity, context) {
        var graph = context.graph();

        if (!isTaggedAsHighway(entity)) return [];

        if (!isDisconnectedWay(entity) &&
            !isDisconnectedMultipolygon(entity) &&
            !isNewRoadUnreachableFromExistingRoads(entity, graph)
        ) {
            return [];
        }

        var entityLabel = utilDisplayLabel(entity, context);
        var fixes = [];
        var entityID = entity.id;

        if (entity.type === 'way' && !entity.isClosed()) {
            var firstID = entity.first();
            var lastID = entity.last();

            var first = context.entity(firstID);
            if (first.tags.noexit !== 'yes') {
                fixes.push(new validationIssueFix({
                    icon: 'iD-operation-continue-left',
                    title: t('issues.fix.continue_from_start.title'),
                    entityIds: [firstID],
                    onClick: function() {
                        var way = context.entity(entityID);
                        var vertex = context.entity(firstID);
                        continueDrawing(way, vertex, context);
                    }
                }));
            }
            var last = context.entity(lastID);
            if (last.tags.noexit !== 'yes') {
                fixes.push(new validationIssueFix({
                    icon: 'iD-operation-continue',
                    title: t('issues.fix.continue_from_end.title'),
                    entityIds: [lastID],
                    onClick: function() {
                        var way = context.entity(entityID);
                        var vertex = context.entity(lastID);
                        continueDrawing(way, vertex, context);
                    }
                }));
            }

        } else {
            fixes.push(new validationIssueFix({
                title: t('issues.fix.connect_feature.title')
            }));
        }

        if (!operationDelete([entity.id], context).disabled()) {
            fixes.push(new validationIssueFix({
                icon: 'iD-operation-delete',
                title: t('issues.fix.delete_feature.title'),
                entityIds: [entity.id],
                onClick: function() {
                    var id = this.issue.entityIds[0];
                    var operation = operationDelete([id], context);
                    if (!operation.disabled()) {
                        operation();
                    }
                }
            }));
        }

        return [new validationIssue({
            type: type,
            severity: 'warning',
            message: (isNewRoad(entity.id)
                ? t('issues.disconnected_way.highway.message_new_road', { highway: entityLabel })
                : t('issues.disconnected_way.highway.message', { highway: entityLabel })
            ),
            tooltip: (isNewRoad(entity.id)
                ? t('issues.disconnected_way.highway.reference_new_road')
                : t('issues.disconnected_way.highway.reference')
            ),
            reference: showReference,
            entityIds: [entity.id],
            fixes: fixes
        })];


        function showReference(selection) {
            selection.selectAll('.issue-reference')
                .data([0])
                .enter()
                .append('div')
                .attr('class', 'issue-reference')
                .text(t('issues.disconnected_way.highway.reference'));
        }


        function vertexIsDisconnected(way, vertex, relation) {
            // can not accurately test vertices on tiles not downloaded from osm - #5938
            var osm = context.connection();
            if (osm && !osm.isDataLoaded(vertex.loc)) {
                return false;
            }

            var parents = graph.parentWays(vertex);

            // standalone vertex
            if (parents.length === 1) return true;

            // entrances are considered connected
            if (vertex.tags.entrance && vertex.tags.entrance !== 'no') return false;

            return !parents.some(function(parentWay) {
                if (parentWay === way) return false;   // ignore the way we're testing
                // count connections to ferry routes as connected
                if (parentWay.tags.route === 'ferry') return true;
                if (isTaggedAsHighway(parentWay)) return true;

                return graph.parentRelations(parentWay).some(function(parentRelation) {
                    // ignore the relation we're testing, if any
                    if (relation && parentRelation === relation) return false;

                    if (parentRelation.tags.type === 'route' &&
                        parentRelation.tags.route === 'ferry') return true;

                    return parentRelation.isMultipolygon() && isTaggedAsHighway(parentRelation);
                });
            });
        }


        function isDisconnectedWay(entity) {
            if (entity.type !== 'way') return false;
            return graph.childNodes(entity).every(function(vertex) {
                return vertexIsDisconnected(entity, vertex);
            });
        }


        // check if entity is a new road that cannot eventually connect to any
        // existing roads
        function isNewRoadUnreachableFromExistingRoads(entity) {
            if (!isNewRoad(entity.id) || !isTaggedAsHighway(entity)) return false;

            var visitedWids = new Set();
            return !connectToExistingRoadOrEntrance(entity, visitedWids);
        }


        function connectToExistingRoadOrEntrance(way, visitedWids) {
            visitedWids.add(way.id);
            for (var i = 0; i < way.nodes.length; i++) {
                var vertex = graph.entity(way.nodes[i]);
                if (vertex.tags.entrance && vertex.tags.entrance !== 'no') return true;

                var parentWays = graph.parentWays(vertex);
                for (var j = 0; j < parentWays.length; j++) {
                    var parentWay = parentWays[j];
                    if (visitedWids.has(parentWay.id)) continue;
                    if (isTaggedAsHighway(parentWay) && !isNewRoad(parentWay.id)) return true;
                    if (connectToExistingRoadOrEntrance(parentWay, visitedWids)) return true;
                }
            }
            return false;
        }


        function isDisconnectedMultipolygon(entity) {
            if (entity.type !== 'relation' || !entity.isMultipolygon()) return false;

            return entity.members.every(function(member) {
                if (member.type !== 'way') return true;

                var way = graph.hasEntity(member.id);
                if (!way) return true;

                return graph.childNodes(way).every(function(vertex) {
                    return vertexIsDisconnected(way, vertex, entity);
                });
            });
        }

        function continueDrawing(way, vertex) {
            // make sure the vertex is actually visible and editable
            var map = context.map();
            if (!map.editable() || !map.trimmedExtent().contains(vertex.loc)) {
                map.zoomToEase(vertex);
            }

            context.enter(
                modeDrawLine(context, way.id, context.graph(), context.graph(), 'line', way.affix(vertex.id), true)
            );
        }
    };


    validation.type = type;

    return validation;
}
