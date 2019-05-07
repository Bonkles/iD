import { actionChangeMember } from '../actions/change_member';
import { actionDeleteMember } from '../actions/delete_member';
import { t } from '../util/locale';
import { utilDisplayLabel } from '../util';
import { validationIssue, validationIssueFix } from '../core/validation';


export function validationMissingRole() {
    var type = 'missing_role';

    var validation = function checkMissingRole(entity, context) {
        var issues = [];
        if (entity.type === 'way') {
            context.graph().parentRelations(entity).forEach(function(relation) {
                if (!relation.isMultipolygon()) return;

                var member = relation.memberById(entity.id);
                if (member && isMissingRole(member)) {
                    issues.push(makeIssue(entity, relation, member, context));
                }
            });
        } else if (entity.type === 'relation' && entity.isMultipolygon()) {
            entity.indexedMembers().forEach(function(member) {
                var way = context.hasEntity(member.id);
                if (way && isMissingRole(member)) {
                    issues.push(makeIssue(way, entity, member, context));
                }
            });
        }

        return issues;
    };


    function isMissingRole(member) {
        return !member.role || !member.role.trim().length;
    }


    function makeIssue(way, relation, member, context) {
        return new validationIssue({
            type: type,
            severity: 'warning',
            message: t('issues.missing_role.message', {
                member: utilDisplayLabel(way, context),
                relation: utilDisplayLabel(relation, context),
            }),
            reference: showReference,
            entityIds: [relation.id, way.id],
            data: {
                member: member
            },
            hash: member.index.toString(),
            fixes: [
                makeAddRoleFix('inner', context),
                makeAddRoleFix('outer', context),
                new validationIssueFix({
                    icon: 'iD-operation-delete',
                    title: t('issues.fix.remove_from_relation.title'),
                    onClick: function() {
                        context.perform(
                            actionDeleteMember(this.issue.entityIds[0], this.issue.data.member.index),
                            t('operations.delete_member.annotation')
                        );
                    }
                })
            ]
        });


        function showReference(selection) {
            selection.selectAll('.issue-reference')
                .data([0])
                .enter()
                .append('div')
                .attr('class', 'issue-reference')
                .text(t('issues.missing_role.multipolygon.reference'));
        }
    }


    function makeAddRoleFix(role, context) {
        return new validationIssueFix({
            title: t('issues.fix.set_as_' + role + '.title'),
            onClick: function() {
                var oldMember = this.issue.data.member;
                var member = { id: this.issue.entityIds[1], type: oldMember.type, role: role };
                context.perform(
                    actionChangeMember(this.issue.entityIds[0], member, oldMember.index),
                    t('operations.change_role.annotation')
                );
            }
        });
    }

    validation.type = type;

    return validation;
}
