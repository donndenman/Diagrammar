// Statecharts module.

'use strict';

var statecharts = (function() {

  // Utilities.
  function isState(item) {
    return item.type != 'transition' && item.type != 'statechart';
  }

  function isStateOrStatechart(item) {
    return item.type != 'transition';
  }

  function isTransition(item) {
    return item.type == 'transition';
  }

  function visit(item, filterFn, itemFn) {
    if (filterFn(item))
      itemFn(item);
    var items = item.items;
    if (items) {
      var length = items.length;
      for (var i = 0; i < length; i++) {
        visit(items[i], filterFn, itemFn);
      }
    }
  }

  function reverseVisit(item, filterFn, itemFn) {
    var items = item.items;
    if (items) {
      var length = items.length;
      for (var i = length - 1; i >= 0; i--) {
        reverseVisit(items[i], filterFn, itemFn);
      }
    }
    if (filterFn(item))
      itemFn(item);
  }

//------------------------------------------------------------------------------

//TODO is this useful?
var graphModel = (function() {
  var proto = {
    getVertexRect: function(state) {
      var transform = this.model.transformableModel.transform(state),
          x = transform[4], y = transform[5];
      if (isState(state))
        return { x: x, y: y, width: v.width, height: v.height };
      // Pseudo-state.
      return { x: x, y: y };
    },
  }

  function extend(model) {
    if (model.graphModel)
      return model.graphModel;

    transformableModel.extend(model);

    var instance = Object.create(proto);
    instance.model = model;

    model.graphModel = instance;
    return instance;
  }

  return {
    extend: extend,
  };
})();

//------------------------------------------------------------------------------

  var editingModel = (function() {
    var functions = {
      reduceSelection: function () {
        var model = this.model;
        model.hierarchicalModel.reduceSelection(model.selectionModel);
      },

      getConnectedTransitions: function (states, copying) {
        var model = this.model,
            statesAndChildren = new HashSet(this.model.dataModel.getId);
        states.forEach(function(item) {
          visit(item, isState, function(item) {
            statesAndChildren.add(item);
          });
        });
        var transitions = [];
        visit(this.statechart, isTransition, function(item) {
          var contains1 = statesAndChildren.contains(item._state1Id);
          var contains2 = statesAndChildren.contains(item._state2Id);
          if (copying) {
            if (contains1 && contains2)
              transitions.push(item);
          } else if (contains1 || contains2) {
            transitions.push(item);
          }
        });
        return transitions;
      },

      deleteItem: function(item) {
        var model = this.model,
            parent = model.hierarchicalModel.getParent(item);
        if (parent) {
          var items = parent.items;
          var length = items.length;
          for (var i = 0; i < length; i++) {
            var subItem = items[i];
            if (subItem === item) {
              model.observableModel.removeElement(parent, items, i);
              break;
            }
          }
        }
      },

      deleteItems: function(items) {
        var self = this;
        this.getConnectedTransitions(items, false).forEach(function(item) {
          self.deleteItem(item);
        });
        items.forEach(function(item) {
          self.deleteItem(item);
        })
      },

      doDelete: function() {
        this.reduceSelection();
        this.prototype.doDelete.call(this);
      },

      copyItems: function(items, map) {
        var model = this.model, transformableModel = model.transformableModel,
            connectedTransitions = this.getConnectedTransitions(items, true),
            copies = this.prototype.copyItems(items.concat(connectedTransitions), map);

        var self = this;
        items.forEach(function(item) {
          var copy = map.find(self.model.dataModel.getId(item));
          if (isState(copy)) {
            var transform = transformableModel.getLocal(item);
            if (transform) {
              copy.x = transform[4];
              copy.y = transform[5];
            }
          }
        });
        return copies;
      },

      doCopy: function() {
        var selectionModel = this.model.selectionModel;
        this.reduceSelection();
        selectionModel.contents().forEach(function(item) {
          if (!isState(item))
            selectionModel.remove(item);
        });
        this.prototype.doCopy.call(this);
      },

      addItems: function(items) {
        var model = this.model, statechart = this.statechart,
            statechartItems = statechart.items;
        items.forEach(function(item) {
          statechart.items.push(item);
          model.selectionModel.add(item);
          model.observableModel.onElementInserted(statechart, statechartItems, statechartItems.length - 1);
        });
      },

      doPaste: function() {
        this.getScrap().forEach(function(item) {
          if (isState(item)) {
            item.x += 16;
            item.y += 16;
          }
        });
        this.prototype.doPaste.call(this);
      },

      addTemporaryItem: function(item) {
        var model = this.model,
            statechart = this.statechart,
            items = statechart.items;
        model.observableModel.insertElement(statechart, items, items.length, item);
      },

      removeTemporaryItem: function() {
        var model = this.model,
            statechart = this.statechart,
            items = statechart.items;
        return model.observableModel.removeElement(statechart, items, items.length - 1);
      },

      addItem: function(item, oldParent, parent) {
        var model = this.model, transformableModel = model.transformableModel;
        if (oldParent !== parent && isState(item)) {
          var transform = transformableModel.getAbsolute(item),
              parentTransform = transformableModel.getAbsolute(parent);
          item.x = transform[4] - parentTransform[4];
          item.y = transform[5] - parentTransform[5];
        }

        var itemToAdd = item;
        if (parent.type != 'statechart') {
          // States can't directly contain a state - add a new statechart if needed.
          if (!parent.items)
            parent.items = [];
          if (!parent.items.length) {
            var newStatechart = {
              type: 'statechart',
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              name: '',
              items: [ item ],
            };
            model.dataModel.assignId(newStatechart);
            itemToAdd = newStatechart;
          }
        }

        if (oldParent !== parent) {
          if (oldParent)            // if null, it's a new item.
            this.deleteItem(item);  // notifies observer
          parent.items.push(itemToAdd);
          model.observableModel.onElementInserted(parent, parent.items, parent.items.length - 1);
        }
      },
    }

    function extend(model) {
      dataModels.dataModel.extend(model);
      dataModels.observableModel.extend(model);
      dataModels.selectionModel.extend(model);
      dataModels.referencingModel.extend(model);
      dataModels.hierarchicalModel.extend(model);
      dataModels.transformableModel.extend(model);
      dataModels.transactionModel.extend(model);
      dataModels.transactionHistory.extend(model);
      dataModels.instancingModel.extend(model);
      dataModels.editingModel.extend(model);

      var instance = Object.create(model.editingModel);
      instance.prototype = Object.getPrototypeOf(instance);
      for (var prop in functions)
        instance[prop] = functions[prop];

      instance.model = model;
      instance.statechart = model.root;

      model.editingModel = instance;
      return instance;
    }

    return {
      extend: extend,
    }
  })();

//------------------------------------------------------------------------------

  function Renderer(model, ctx, theme) {
    diagrams.GraphRenderer.call(this, ctx, theme);
    this.model = model;
    this.transformableModel = model.transformableModel;
    this.stateMinWidth = 100;
    this.stateMinHeight = 60;
    this.knobbySize = 4;
  }

  Renderer.prototype = Object.create(diagrams.GraphRenderer.prototype);

  Renderer.prototype.getVertexRect = function(v) {
    var transform = this.transformableModel.getAbsolute(v),
        x = transform[4], y = transform[5];
    if (isState(v))
      return { x: x, y: y, width: v.width, height: v.height };

    return { x: x, y: y };
  }

  Renderer.prototype.updateTransition = function(transition, endPt) {
    var v1 = transition._state1Id, t1 = transition.t1,
        v2 = transition._state2Id, t2 = transition.t2;
    this.updateBezier(transition, v1, t1, v2, t2, endPt);
  }

  Renderer.prototype.drawState = function(state) {
    var ctx = this.ctx, r = this.radius,
        type = state.type,
        rect = this.getVertexRect(state),
        x = rect.x, y = rect.y;
    this.drawVertex(state);
    if (type == 'state') {
      var w = state.width, h = state.height;
      ctx.beginPath();
      var lineBase = y + this.textSize + this.textLeading;
      ctx.moveTo(x, lineBase);
      ctx.lineTo(x + w, lineBase);
      ctx.stroke();

      ctx.fillStyle = this.textColor;
      ctx.fillText(state.name, x + r, y + this.textSize);
    } else if (type == 'start') {
      ctx.fillStyle = this.strokeColor;
      ctx.fill();
    }
  }

  Renderer.prototype.getStateMinSize = function(state) {
    var ctx = this.ctx, r = this.radius,
        width = this.stateMinWidth, height = this.stateMinHeight,
        metrics;
    if (state.type != 'state')
      return;
    width = Math.max(width, this.measureText(state.name) + 2 * r);
    height = Math.max(height, this.textSize + this.textLeading);
    return { width: width, height: height };
  }

  Renderer.prototype.getKnobbies = function(state) {
    var rect = this.getVertexRect(state),
        x = rect.x, y = rect.y, width = rect.width, height = rect.height,
        r = this.radius, xOffset = 2 * r,
        knobbies = {};
    if (state.type == 'state') {
      knobbies.transition = {
        x: x + width + xOffset,
        y: y + this.textSize + this.textLeading,
        nx: -1,
        ny: 0
      }
      if (state.items) {
        knobbies.vertStatechart = {
          x: x + width / 2,
          y: y + height
        }
      }
    } else {
      knobbies.transition = {
        x: x + r + r + xOffset,
        y: y + r,
        nx: -1,
        ny: 0
      }
    }
    return knobbies;
  }

  Renderer.prototype.drawKnobbies = function(state) {
    var ctx = this.ctx, knobbySize = this.knobbySize,
        knobbies = this.getKnobbies(state),
        transition = knobbies.transition,
        vertStatechart = knobbies.vertStatechart;
    if (transition) {
      ctx.beginPath();
      diagrams.arrowPath(transition, ctx, this.arrowSize);
      ctx.stroke();
    }
    if (vertStatechart)
      ctx.strokeRect(vertStatechart.x - knobbySize, vertStatechart.y - knobbySize, 2 * knobbySize, 2 * knobbySize);
  }

  Renderer.prototype.hitTestState = function(state, p) {
    var hitInfo = this.hitTestVertex(state, p);
    if (hitInfo)
      hitInfo.item = state;
    return hitInfo;
  }

  Renderer.prototype.hitTestTransition = function(transition, p) {
    var hitInfo = this.hitTestEdge(transition, p);
    if (hitInfo)
      hitInfo.item = transition;
    return hitInfo;
  }

  Renderer.prototype.hitKnobby = function(state, p) {
    var tol = this.hitTolerance + this.knobbySize,
        knobbies = this.getKnobbies(state),
        transition = knobbies.transition;
    if (transition && diagrams.hitPoint(transition.x, transition.y, p, tol))
      return 'transition';
  }

//------------------------------------------------------------------------------

  function Editor(model, theme, canvas, updateFn) {
    var self = this;
    this.model = model;
    this.statechart = model.root;
    editingModel.extend(model);

    this.canvas = canvas;
    this.updateFn = updateFn;

    this.ctx = canvas.getContext('2d');

    if (!theme)
      theme = diagrams.theme.create();
    var renderer = this.renderer = new Renderer(model, ctx, theme);

    var palette = this.palette = {
      root: {
        type: 'palette',
        x: 0,
        y: 0,
        items: [
          {
            type: 'start',
            x: 64,
            y: 64,
          },
          {
            type: 'state',
            x: 32,
            y: 96,
            width: renderer.stateMinWidth,
            height: renderer.stateMinHeight,
            name: 'New State',
          },
        ]
      }
    }
    dataModels.observableModel.extend(palette);
    dataModels.hierarchicalModel.extend(palette);
    dataModels.transformableModel.extend(palette);

    this.mouseController = new diagrams.MouseController();
    this.mouseController.addHandler('beginDrag', function() {
      self.beginDrag();
    });

    this.validateLayout();
  }

  Editor.prototype.isPaletteItem = function(item) {
    var hierarchicalModel = this.palette.hierarchicalModel;
    return hierarchicalModel.getParent(item) === this.palette.root;
  }

  // Make sure states and statecharts are sized to hold their contents.
  Editor.prototype.validateLayout = function() {
    var renderer = this.renderer, statechart = this.statechart,
        stateMinWidth = renderer.stateMinWidth,
        stateMinHeight = renderer.stateMinHeight;
    reverseVisit(statechart, isStateOrStatechart, function(item) {
      if (item.type == 'state') {
        var minSize = renderer.getStateMinSize(item);
        item.width = Math.max(item.width || 0, minSize.width);
        item.height = Math.max(item.height || 0, minSize.height);
      }

      if (item.items) {
        var minX = 0, minY = 0, maxX = 0, maxY = 0;
        var items = item.items;
        for (var i = 0; i < items.length; i++) {
          var subItem = items[i];
          if (isTransition(subItem))
            continue;
          minX = Math.min(minX, subItem.x);
          minY = Math.min(minY, subItem.y);
          var subItemWidth = subItem.width || stateMinWidth;
          subItemWidth = Math.max(subItemWidth, stateMinWidth);
          var subItemHeight = subItem.height || stateMinHeight;
          subItemHeight = Math.max(subItemHeight, stateMinHeight);

          maxX = Math.max(maxX, subItem.x + subItemWidth);
          maxY = Math.max(maxY, subItem.y + subItemHeight);

        }
        var minWidth = maxX - minX, minHeight = maxY - minY;
        if (item.type == 'state') {
          if (item.width < minWidth)
            item.width = minWidth;
          if (item.height < minHeight)
            item.height = minHeight;
        } else {
          item.width = minWidth;
          item.height = minHeight;
        }

        if (minX < 0) {
          item.x += minX;
          for (var i = 0; i < items.length; i++)
            items[i].x -= minX;
        }
        if (minY < 0) {
          item.y += minY;
          for (var i = 0; i < items.length; i++)
            items[i].y -= minY;
        }
      }
    });
  }

  Editor.prototype.draw = function() {
    var self = this,
        renderer = this.renderer, statechart = this.statechart,
        model = this.model, palette = this.palette,
        ctx = this.ctx;
    var mousePt = this.mouseController.getMouse();
    mousePt.nx = mousePt.ny = 0;
    visit(statechart, isTransition, function(transition) {
      renderer.updateTransition(transition, mousePt);
    });

    renderer.beginDraw();
    visit(statechart, isState, function(state) {
      renderer.drawState(state, ctx);
    });
    visit(statechart, isTransition, function(transition) {
      renderer.drawEdge(transition, ctx);
    });

    ctx.lineWidth = 2;
    ctx.strokeStyle = renderer.theme.highlightColor;
    model.selectionModel.forEach(function(item) {
      if (isState(item)) {
        renderer.drawKnobbies(item);
        renderer.strokeVertex(item);
      } else {
        renderer.strokeEdge(item);
      }
    });
    if (this.hotTrackInfo) {
      ctx.strokeStyle = renderer.theme.hotTrackColor;
      renderer.strokeVertex(this.hotTrackInfo.item);
    }
    renderer.endDraw();

    renderer.beginDraw();
    palette.root.items.forEach(function(state) {
      renderer.drawState(state);
    });
    renderer.endDraw();
  }

  // filter functions.
  function firstHit(item, hitInfo) {
    return hitInfo;
  }

  function firstStateHit(item, hitInfo) {
    return firstHit(item, hitInfo) || !isState(item);
  }

  Editor.prototype.hitTest = function(p, filterFn) {
    var renderer = this.renderer,
        statechart = this.statechart, model = this.model,
        palette = this.palette;
    var hitInfo = null;
    if (!filterFn)
      filterFn = firstHit;

    reverseVisit(palette.root, isState, function(state) {
      if (filterFn(state, hitInfo))
        return;
      hitInfo = renderer.hitTestState(state, p);
    });
    if (hitInfo)
      return hitInfo;

    reverseVisit(statechart, isTransition, function(transition) {
      if (filterFn(transition, hitInfo))
        return;
      hitInfo = renderer.hitTestTransition(transition, p);
    });
    if (hitInfo)
      return hitInfo;

    reverseVisit(statechart, isState, function(state) {
      if (filterFn(state, hitInfo))
        return;
      if (model.selectionModel.contains(state)) {
        switch (renderer.hitKnobby(state, p)) {
          case 'transition':
            hitInfo = { item: state, transition: true };
            break;
          default:
            hitInfo = renderer.hitTestState(state, p);
            break;
        }
      } else {
        hitInfo = renderer.hitTestState(state, p);
      }
    });
    return hitInfo;
  }

  Editor.prototype.beginDrag = function() {
    var mouseHitInfo = this.mouseHitInfo, model = this.model;
    if (!mouseHitInfo)
      return;
    this.dragItem = mouseHitInfo.item;
    if (this.isPaletteItem(this.dragItem)) {
      // Clone palette item and add the clone to the top level statechart. Don't
      // notify observers yet.
      this.dragItem = model.instancingModel.clone(mouseHitInfo.item);
      model.editingModel.addTemporaryItem(this.dragItem);
      model.selectionModel.set([ this.dragItem ]);
      this.addingNewItem = true;
    } else if (!isTransition(this.dragItem)) {
      model.editingModel.reduceSelection();
    }
    switch (this.dragItem.type) {
      case 'state':
        if (mouseHitInfo.transition)
          this.dragType = 'newTransition';
        else if (mouseHitInfo.border)
          this.dragType = 'sizing';
        else
          this.dragType = 'moving';
        break;
      case 'start':
        if (mouseHitInfo.transition)
          this.dragType = 'newTransition';
        else
          this.dragType = 'moving'
        break;
      case 'transition':
        if (mouseHitInfo.p1)
          this.dragType = 'connectingP1';
        else
          this.dragType = 'connectingP2';
        break;
    }
    if (this.dragType == 'newTransition') {
      this.dragItem = {
        type: 'transition',
        state1Id: model.dataModel.getId(mouseHitInfo.item),  // state1 was hit.
        t1: 0,
        state2Id: 0,
        t2: 0,
      };
      model.dataModel.assignId(this.dragItem),
      model.editingModel.addTemporaryItem(this.dragItem);
      model.selectionModel.set([ this.dragItem ]);
      mouseHitInfo.item = this.dragItem;
      this.dragType = 'connectingP2';
      this.addingNewItem = true;
    }

    this.valueTracker = new dataModels.ValueChangeTracker(model);
  }

  Editor.prototype.endDrag = function() {
    var model = this.model, statechart = this.statechart,
        selectionModel = model.selectionModel;
    // Remove any item that have been temporarily added before starting the
    // transaction.
    var newItem = this.addingNewItem ? model.editingModel.removeTemporaryItem() : null;

    model.transactionModel.beginTransaction("Drag");

    if (this.dragType == 'moving') {
      // Find state beneath mouse.
      var hitInfo = this.hitTest(this.mouseController.getMouse(), function(item, hitInfo) {
        return firstStateHit(item, hitInfo) || selectionModel.contains(item);
      });
      var parent = statechart;
      if (hitInfo)
        parent = hitInfo.item;
      // Add new items.
      if (this.addingNewItem) {
        model.editingModel.addItem(newItem, null, parent, this.renderer);
      } else {
        // Reparent existing items.
        model.selectionModel.forEach(function(item) {
          if (isState(item)) {
            var oldParent = model.hierarchicalModel.getParent(item);
            if (oldParent != parent)
              model.editingModel.addItem(item, oldParent, parent, self.renderer);
          }
        });
      }
    } else if (this.dragType == 'newTransition') {
      var parent = this.statechart;
      model.observableModel.onElementInserted(parent, parent.items, parent.items.length - 1);
    }

    this.validateLayout();
    this.valueTracker.end();
    this.valueTracker = null;

    if (isTransition(this.dragItem)) {
      var transition = this.dragItem;
      if (!transition.state1Id || !transition.state2Id) {
        model.editingModel.deleteItem(transition);
        model.selectionModel.remove(transition);
      } else if (this.addingNewItem) {
        model.editingModel.addItem(transition, null, statechart, this.renderer);
      }
    }

    model.transactionModel.endTransaction();

    this.addingNewItem = false;
    this.dragItem = null;
    this.mouseHitInfo = null;
    this.hotTrackInfo = null;
  }

  Editor.prototype.drag = function() {
    var self = this,
        model = this.model,
        dataModel = model.dataModel,
        observableModel = model.observableModel,
        referencingModel = model.referencingModel,
        selectionModel = model.selectionModel,
        renderer = this.renderer,
        mouseHitInfo = this.mouseHitInfo, dragItem = this.dragItem,
        mouseController = this.mouseController,
        p = mouseController.getMouse(),
        dP = mouseController.getDragOffset(),
        snapshot = this.valueTracker.getSnapshot(dragItem),
        hitInfo, state;
    switch (this.dragType) {
      case 'moving':
        hitInfo = this.hotTrackInfo = this.hitTest(p, function(item, hitInfo) {
          return firstStateHit(item, hitInfo) || selectionModel.contains(item);
        });
        selectionModel.forEach(function(item) {
          var snapshot = self.valueTracker.getSnapshot(item);
          if (snapshot) {
            observableModel.changeValue(item, 'x', snapshot.x + dP.x);
            observableModel.changeValue(item, 'y', snapshot.y + dP.y);
          }
        });
        break;
      case 'sizing':
        if (mouseHitInfo.left) {
          observableModel.changeValue(dragItem, 'x', snapshot.x + dP.x);
          observableModel.changeValue(dragItem, 'width', snapshot.width - dP.x);
        }
        if (mouseHitInfo.top) {
          observableModel.changeValue(dragItem, 'y', snapshot.y + dP.y);
          observableModel.changeValue(dragItem, 'height', snapshot.height - dP.y);
        }
        if (mouseHitInfo.right)
          observableModel.changeValue(dragItem, 'width', snapshot.width + dP.x);
        if (mouseHitInfo.bottom)
          observableModel.changeValue(dragItem, 'height', snapshot.height + dP.y);
        break;
      case 'connectingP1':
        hitInfo = this.hotTrackInfo = this.hitTest(p, firstStateHit);
        observableModel.changeValue(dragItem, 'state1Id', hitInfo && hitInfo.border ? dataModel.getId(hitInfo.item) : 0);
        state = referencingModel.getReference(dragItem, 'state1Id');
        if (state)
          observableModel.changeValue(dragItem, 't1', renderer.vertexPointToParam(state, p));
        break;
      case 'connectingP2':
        if (this.addingNewItem) {
          var srcState = referencingModel.getReference(dragItem, 'state1Id');
          observableModel.changeValue(dragItem, 't1', renderer.vertexPointToParam(srcState, p));
        }
        hitInfo = this.hotTrackInfo = this.hitTest(p, firstStateHit);
        observableModel.changeValue(dragItem, 'state2Id', hitInfo && hitInfo.border ? dataModel.getId(hitInfo.item) : 0);
        state = referencingModel.getReference(dragItem, 'state2Id');
        if (state)
          observableModel.changeValue(dragItem, 't2', renderer.vertexPointToParam(state, p));
        break;
    }
  }

  Editor.prototype.onMouseDown = function(e) {
    var model = this.model,
        mouseController = this.mouseController,
        mouseHitInfo = this.mouseHitInfo = this.hitTest(mouseController.getMouse());
    mouseController.onMouseDown(e);
    if (mouseHitInfo) {
      if (!model.selectionModel.contains(mouseHitInfo.item) && !this.shiftKeyDown)
        model.selectionModel.clear();
      if (!this.isPaletteItem(mouseHitInfo.item))
        model.selectionModel.add(mouseHitInfo.item);
      this.updateFn(this);
    } else {
      if (!this.shiftKeyDown) {
        model.selectionModel.clear();
        this.updateFn(this);
      }
    }
  }

  Editor.prototype.onMouseMove = function(e) {
    var mouseController = this.mouseController, mouseHitInfo = this.mouseHitInfo;
    mouseController.onMouseMove(e);
    var didClickItem = mouseHitInfo && mouseHitInfo.item;
    if (didClickItem && mouseController.isDragging) {
      this.drag();
      this.updateFn(this);
    }
  }

  Editor.prototype.onMouseUp = function(e) {
    var mouseController = this.mouseController, mouseHitInfo = this.mouseHitInfo;
    if (mouseHitInfo && mouseHitInfo.item && mouseController.isDragging) {
      this.endDrag();
      this.updateFn(this);
      this.mouseHitInfo = null;
    }
    mouseController.onMouseUp(e);
  }

  Editor.prototype.onKeyDown = function(e) {
    var model = this.model,
        statechart = this.statechart,
        selectionModel = model.selectionModel,
        editingModel = model.editingModel,
        transactionHistory = model.transactionHistory,
        updateFn = this.updateFn;

    this.shiftKeyDown = e.shiftKey;
    if (e.keyCode == 8) {
      e.preventDefault();
      editingModel.doDelete();
      updateFn(this);
    } else if (e.ctrlKey) {
      if (e.keyCode == 65) {  // 'a'
        statechart.items.forEach(function(v) {
          selectionModel.add(v);
        });
        updateFn(this);
      } else if (e.keyCode == 90) {  // 'z'
        if (transactionHistory.getUndo()) {
          selectionModel.clear();
          transactionHistory.undo();
          updateFn(this);
        }
      } else if (e.keyCode == 89) {  // 'y'
        if (transactionHistory.getRedo()) {
          selectionModel.clear();
          transactionHistory.redo();
          updateFn(this);
        }
      } else if (e.keyCode == 88) { // 'x'
        editingModel.doCut();
        updateFn(this);
      } else if (e.keyCode == 67) { // 'c'
        editingModel.doCopy();
        updateFn(this);
      } else if (e.keyCode == 86) { // 'v'
        if (editingModel.getScrap()) {
          editingModel.doPaste();
          updateFn(this);
        }
      } else if (e.keyCode == 71) { // 'g'
        // board_group();
        // renderEditor();
      } else if (e.keyCode == 83) { // 's'
        var text = JSON.stringify(
          statechart,
          function(key, value) {
            if (key.toString().charAt(0) == '_')
              return;
            return value;
          },
          2);
        // Writes statechart as JSON to console.
        console.log(text);
      }
    }
  }

  Editor.prototype.onKeyUp = function(e) {
    this.shiftKeyDown = e.shiftKey;
  }

  return {
    graphModel: graphModel,
    editingModel: editingModel,
    Renderer: Renderer,
    Editor: Editor,
  };
})();


var statechart_data = {
  "type": "statechart",
  "id": 1001,
  "x": 0,
  "y": 0,
  "width": 845,
  "height": 422,
  "name": "Example",
  "items": [
    {
      "type": "start",
      "id": 1002,
      "x": 165,
      "y": 83
    },
    {
      "type": "state",
      "id": 1003,
      "x": 207,
      "y": 81,
      "width": 300,
      "height": 200,
      "name": "State_1",
      "items": [
        {
          "type": "statechart",
          "id": 1004,
          "x": 0,
          "y": 0,
          "width": 250,
          "height": 145,
          "items": [
            {
              "type": "state",
              "id": 1005,
              "x": 30,
              "y": 45,
              "width": 100,
              "height": 100,
              "name": "State_3",
              "items": []
            },
            {
              "type": "state",
              "id": 1006,
              "x": 150,
              "y": 30,
              "width": 100,
              "height": 100,
              "name": "State_4"
            }
          ]
        }
      ]
    },
    {
      "type": "state",
      "id": 1007,
      "x": 545,
      "y": 222,
      "width": 300,
      "height": 200,
      "name": "State_2",
      "items": []
    },
    {
      "type": "transition",
      "id": 1008,
      "state1Id": 1003,
      "t1": 1.4019607843137254,
      "state2Id": 1007,
      "t2": 2.3
    }
  ]
}
