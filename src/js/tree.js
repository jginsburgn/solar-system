function buildTree(tree, eventHandler) {
  $('#tree').jstree({
    core: {
      multiple: false,
      data: [
        tree
      ]
    }
  });
  $.jstree.reference("#tree").hide_icons();
  $("#tree").on("changed.jstree", eventHandler);
}