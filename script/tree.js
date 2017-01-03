/**
 * Script for the tree management interface
 */

var $GUI = jQuery('#plugin_move__tree');

$GUI.show();
jQuery('#plugin_move__treelink').show();

/**
 * Checks if the given list item was moved in the tree
 *
 * Moved elements are highlighted and a title shows where they came from
 *
 * @param {jQuery} $li
 */
var checkForMovement = function ($li) {
    // we need to check this LI and all previously moved sub LIs
    var $all = $li.add($li.find('li.moved'));
    $all.each(function () {
        var $this = jQuery(this);
        var oldid = $this.data('id');
        var newid = determineNewID($this);

        if (newid != oldid) {
            $this.addClass('moved');
            $this.children('div').attr('title', oldid + ' -> ' + newid);
        } else {
            $this.removeClass('moved');
            $this.children('div').attr('title', '');
        }
    });
};

/**
 * Check if the given name is allowed in the given parent
 *
 * @param {jQuery} $li the edited or moved LI
 * @param {jQuery} $parent the (new) parent of the edited or moved LI
 * @param {string} name the (new) name to check
 * @returns {boolean}
 */
var checkNameAllowed = function ($li, $parent, name) {
    var ok = true;
    $parent.children('li').each(function () {
        if (this === $li[0]) return;
        var cname = 'type-f';
        if ($li.hasClass('type-d')) cname = 'type-d';

        var $this = jQuery(this);
        if ($this.data('name') == name && $this.hasClass(cname)) ok = false;
    });
    return ok;
};

/**
 * Returns the new ID of a given list item
 *
 * @param {jQuery} $li
 * @returns {string}
 */
var determineNewID = function ($li) {
    var myname = $li.data('name');

    var $parent = $li.parent().closest('li');
    if ($parent.length) {
        return (determineNewID($parent) + ':' + myname).replace(/^:/, '');
    } else {
        return myname;
    }
};

/**
 * Very simplistic cleanID() in JavaScript
 *
 * Strips out namespaces
 *
 * @param {string} id
 */
var cleanID = function (id) {
    if (!id) return '';

    id = id.replace(/[!"#$%§&\'()+,/;<=>?@\[\]^`\{|\}~\\;:\/\*]+/g, '_');
    id = id.replace(/^_+/, '');
    id = id.replace(/_+$/, '');
    id = id.toLowerCase();

    return id;
};

/**
 * Initialize the drag & drop-tree starting at the given ul (must be this).
 */
var initTree = function () {
    var my_root = jQuery(this).closest('.tree_root')[0];
    jQuery(this).find('li').draggable({
        revert: true,
        revertDuration: 0,
        opacity: 0.5,
        stop : function(event, ui) {
            ui.helper.css({height: "auto", width: "auto"});
        }
    }).droppable({
        tolerance: 'pointer',
        greedy: true,
        accept : function(draggable) {
            return my_root == draggable.closest('.tree_root')[0];
        },
        drop : function (event, ui) {
            var $dropped = ui.draggable;
            var $me = jQuery(this);

            if ($dropped.children('div.li').children('input').prop('checked')) {
                $dropped = $dropped.add(
                    jQuery(my_root)
                    .find('input')
                    .filter(function() {
                        return jQuery(this).prop('checked');
                    }).parent().parent()
                );
            }

            if ($me.parents().addBack().is($dropped)) {
                return;
            }

            var allowed = true;
            if ($me.hasClass("type-f") || $me.hasClass("closed")) {
                $dropped.each(function () {
                    var $this = jQuery(this);
                    allowed &= checkNameAllowed($this, $me.parent(), $this.data('name'));
                });
                if (allowed) {
                    $dropped.insertAfter($me);
                }
            } else {
                var $new_parent = $me.children('ul');

                $dropped.each(function () {
                    var $this = jQuery(this);
                    allowed &= checkNameAllowed($this, $new_parent, $this.data('name'));
                });

                if (allowed) {
                    $dropped.prependTo($new_parent);
                }
            }

            checkForMovement($dropped);
        }
    })
    // add title to rename icon
    .find('img').attr('title', LANG.plugins.move.renameitem);
};

/**
 * Attach event listeners to the tree
 */
$GUI.find('div.tree_root > ul.tree_list')
    .click(function (e) {
        var $clicky = jQuery(e.target);
        var $li = $clicky.parent().parent();

        if ($clicky[0].tagName == 'A' && $li.hasClass('type-d')) {  // Click on folder - open and close via AJAX
            e.stopPropagation();
            if ($li.hasClass('open')) {
                $li
                    .removeClass('open')
                    .addClass('closed');

            } else {
                $li
                    .removeClass('closed')
                    .addClass('open');

                // if had not been loaded before, load via AJAX
                if (!$li.find('ul').length) {
                    var is_media = $li.closest('div.tree_root').hasClass('tree_media') ? 1 : 0;
                    jQuery.post(
                        DOKU_BASE + 'lib/exe/ajax.php',
                        {
                            call: 'plugin_move_tree',
                            ns: $clicky.attr('href'),
                            is_media: is_media
                        },
                        function (data) {
                            $li.append(data);
                            $li.children('ul').each(initTree);
                        }
                    );
                }
            }
            e.preventDefault();
        } else if ($clicky[0].tagName == 'IMG') { // Click on IMG - do rename
            e.stopPropagation();
            var $a = $clicky.parent().find('a');

            var newname = window.prompt(LANG.plugins.move.renameitem, $li.data('name'));
            newname = cleanID(newname);
            if (newname) {
                if (checkNameAllowed($li, $li.parent(), newname)) {
                    $li.data('name', newname);
                    $a.text(newname);
                    checkForMovement($li);
                } else {
                    alert(LANG.plugins.move.duplicate.replace('%s', newname));
                }
            }
            e.preventDefault();
        }
    }).each(initTree);

/**
 * Gather all moves from the trees and put them as JSON into the form before submit
 *
 * @fixme has some duplicate code
 */
jQuery('#plugin_move__tree_execute').submit(function (e) {
    var data = [];

    $GUI.find('.tree_pages .moved').each(function (idx, el) {
        var $el = jQuery(el);
        var newid = determineNewID($el);

        data[data.length] = {
            'class': $el.hasClass('type-d') ? 'ns' : 'doc',
            type: 'page',
            src: $el.data('id'),
            dst: newid
        };
    });
    $GUI.find('.tree_media .moved').each(function (idx, el) {
        var $el = jQuery(el);
        var newid = determineNewID($el);

        data[data.length] = {
            'class': $el.hasClass('type-d') ? 'ns' : 'doc',
            type: 'media',
            src: $el.data('id'),
            dst: newid
        };
    });

    jQuery(this).find('input[name=json]').val(JSON.stringify(data));
});
