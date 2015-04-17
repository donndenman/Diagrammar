// Pinball shapes module.

'use strict';

var shapes = (function() {

  // Utilities.

  function visit(item, itemFn) {
    itemFn(item);
    var items = item.items;
    if (items) {
      var length = items.length;
      for (var i = 0; i < length; i++)
        visit(items[i], itemFn);
    }
  }

  function reverseVisit(item, itemFn) {
    var items = item.items;
    if (items) {
      var length = items.length;
      for (var i = length - 1; i >= 0; i--)
        reverseVisit(items[i], itemFn);
    }
    itemFn(item);
  }

  function isHullItem(item) {
    return item.type === 'disk' || item.type === 'edge' ||
           item.type === 'group';
  }

  function isHull(item) {
    return item.type === 'group';
  }

  function isEdgeItem(item) {
    return item.type === 'point';
  }

  function isEdge(item) {
    return item.type === 'edge';
  }

//------------------------------------------------------------------------------

  var editingModel = (function() {
    var functions = {
      reduceSelection: function() {
        this.model.hierarchicalModel.reduceSelection();
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
              model.observableModel.removeElement(parent, 'items', i);
              break;
            }
          }
        }
      },

      deleteItems: function(items) {
        var self = this;
        items.forEach(function(item) {
          self.deleteItem(item);
        })
      },

      doDelete: function() {
        this.reduceSelection();
        this.prototype.doDelete.call(this);
      },

      copyItems: function(items, map) {
        var model = this.model, dataModel = model.dataModel,
            transformableModel = model.transformableModel,
            copies = this.prototype.copyItems(items, map),
            board = this.board;

        items.forEach(function(item) {
          var copy = map.find(dataModel.getId(item));
          var toGlobal = transformableModel.getToParent(item, board);
          geometry.matMulPt(copy, toGlobal);
        });
        return copies;
      },

      doCopy: function() {
        var selectionModel = this.model.selectionModel;
        this.reduceSelection();
        selectionModel.contents().forEach(function(item) {
          // if (!isState(item))
          //   selectionModel.remove(item);
        });
        this.prototype.doCopy.call(this);
      },

      addItems: function(items) {
        var self = this, selectionModel = this.model.selectionModel;
        items.forEach(function(item) {
          self.addItem(item, self.board);
          selectionModel.add(item);
        });
      },

      doPaste: function() {
        this.getScrap().forEach(function(item) {
          item.x += 16;
          item.y += 16;
        });
        this.prototype.doPaste.call(this);
      },

      addItem: function(item, parent) {
        var model = this.model, hierarchicalModel = model.hierarchicalModel,
            oldParent = hierarchicalModel.getParent(item);
        if (oldParent !== parent) {
          var transformableModel = model.transformableModel,
              toParent = transformableModel.getToParent(item, parent);
          geometry.matMulPt(item, toParent);
          this.deleteItem(item);  // notifies observer
          model.observableModel.insertElement(parent, 'items', parent.items.length, item);
        }
      },

      addPoint: function(point, edge) {
        // var model = this.model;
        // if (oldParent !== parent) {
        //   var transformableModel = model.transformableModel;
        //   if (oldParent) {          // if null, it's a new item.
        //     geometry.matMulPt(item, transformableModel.getAbsolute(oldParent));
        //     this.deleteItem(item);  // notifies observer
        //   }

        //   geometry.matMulPt(item, transformableModel.getInverseAbsolute(parent));
        // }
        // var x = point.x,
        //     points = edge.items, length = points.length;
        // for (var i = 0; i < length; i++) {
        //   if (x < points[i].x)
        //     break;
        // }
        // this.model.observableModel.insertElement(edge, 'items', i, point);
      }
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
      instance.board = model.root;

      model.editingModel = instance;
      return instance;
    }

    return {
      extend: extend,
    }
  })();

//------------------------------------------------------------------------------

  var normalMode = 1,
      highlightMode = 2,
      hotTrackMode = 4;

  function Renderer(theme) {
    this.knobbyRadius = 4;

    this.theme = theme || diagrams.theme.create();
  }

  Renderer.prototype.beginDraw = function(model, ctx) {
    this.model = model;
    this.transformableModel = model.transformableModel;
    this.ctx = ctx;
    ctx.save();
    ctx.font = this.theme.font;
  }

  Renderer.prototype.endDraw = function() {
    this.ctx.restore();
    this.model = null;
    this.ctx = null;
  }

  function drawKnobby(renderer, r, x, y) {
    var d = 2 * r;
    renderer.ctx.strokeRect(x - r, y - r, d, d);
  }

  Renderer.prototype.drawItem = function(item, mode) {
    var ctx = this.ctx, theme = this.theme,
        transformableModel = this.transformableModel,
        ooScale = 1.0 / transformableModel.getUniformScale(item),
        knobbyRadius = this.knobbyRadius * ooScale,
        t = item._atransform;
    ctx.save();
    ctx.transform(t[0], t[2], t[1], t[3], t[4], t[5]); // local to world

    if (mode & normalMode) {
      ctx.fillStyle = theme.bgColor;
      ctx.strokeStyle = theme.strokeColor;
      ctx.lineWidth = 0.25 * ooScale;
    } else if (mode & highlightMode) {
      ctx.strokeStyle = theme.highlightColor;
      ctx.lineWidth = 2.0 * ooScale;
    } else if (mode & hotTrackMode) {
      ctx.strokeStyle = theme.hotTrackColor;
      ctx.lineWidth = 2.0 * ooScale;
    }

    switch (item.type) {
      case 'disk':
        ctx.beginPath();
        var r = item.radius;
        if (mode & normalMode) {
          ctx.arc(0, 0, r, 0, 2 * Math.PI, false);
          ctx.setLineDash([4]);
          ctx.stroke();
          ctx.setLineDash([0]);
        }
        drawKnobby(this, knobbyRadius, 0, 0);
        ctx.strokeRect(-knobbyRadius, -knobbyRadius, 2 * knobbyRadius, 2 * knobbyRadius);
        drawKnobby(this, knobbyRadius, r, 0);
        break;
      case 'point':
        ctx.beginPath();
        ctx.arc(0, 0, knobbyRadius, 0, 2 * Math.PI, false);
        ctx.stroke();
        break;
      case 'edge':
        var dx = item.dx, dy = item.dy,
            points = item.items, length = points.length;
        ctx.lineWidth = 0.25;
        if (mode & normalMode) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(1, 0);
          ctx.setLineDash([4]);
          ctx.stroke();
          ctx.setLineDash([0]);
        }
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.moveTo(0, 0);
        for (var i = 0; i < length; i++) {
          var pi = points[i];
          ctx.lineTo(pi.x, pi.y);
        }
        ctx.lineTo(1, 0);
        ctx.stroke();
        if (mode & normalMode)
          ctx.lineWidth = 0.25 * ooScale;
        drawKnobby(this, knobbyRadius, 0, 0);
        drawKnobby(this, knobbyRadius, 1, 0);
        break;
      // case 'linear':
      //   ctx.lineWidth = 0.25;
      //   ctx.beginPath();
      //   ctx.moveTo(0, 0);
      //   ctx.lineTo(item.dx, item.dy);
      //   ctx.setLineDash([4]);
      //   ctx.stroke();
      //   ctx.setLineDash([0]);
      //   if (mode & highlightMode) {
      //     var p1 = item._p1, p2 = item._p2;
      //     if (p1 && p2) {
      //       drawKnobby(this, p1.x, p1.y);
      //       drawKnobby(this, p2.x, p2.y);
      //     }
      //     drawKnobby(this, 0, 0);
      //     drawKnobby(this, item.dx, item.dy);
      //   }
      //   break;
      // case 'bezier':
      //   ctx.beginPath();
      //   // Start at first point of first curve segment.
      //   ctx.moveTo(item._curves[0][0].x, item._curves[0][0].y);
      //   for (var i = 0; i < item._curves.length; i++) {
      //     var seg = item._curves[i];
      //     ctx.bezierCurveTo(seg[1].x, seg[1].y, seg[2].x, seg[2].y, seg[3].x, seg[3].y);
      //   }
      //   ctx.stroke();
      //   ctx.beginPath();
      //   ctx.moveTo(-item.halfLength, 0);
      //   ctx.lineTo(item.halfLength, 0);
      //   ctx.setLineDash([5]);
      //   ctx.stroke();
      //   ctx.setLineDash([0]);
      //   if (mode & highlightMode) {
      //     for (var i = 0; i < item.points.length; i++) {
      //       var pi = item.points[i];
      //       drawKnobby(this, pi.x, pi.y);
      //     }
      //     drawKnobby(this, -item.halfLength, 0);
      //     drawKnobby(this, 0, 0);
      //     drawKnobby(this, item.halfLength, 0);
      //   }
      //   break;
      case 'group':
        if (!item.op || !item._paths)
          break;
        for (var i = 0; i < item._paths.length; i++) {
          var path = item._paths[i];
          ctx.beginPath();
          var p = path[path.length - 1];
          ctx.moveTo(p.x, p.y);
          for (var j = 0; j < path.length; j++) {
            p = path[j];
            ctx.lineTo(p.x, p.y);
          }
          ctx.lineWidth = 2;
          if (item.diff) {
            ctx.setLineDash([5]);
            ctx.stroke();
            ctx.setLineDash([0]);
          } else {
            if (mode & normalMode)
              ctx.fill();
            ctx.stroke();
          }
        }
        break;
    }
    ctx.restore();
  }

  Renderer.prototype.hitTest = function(item, p, tol, mode) {
    var knobbyRadius = this.knobbyRadius,
        transformableModel = this.transformableModel,
        inverseTransform = transformableModel.getInverseAbsolute(item),
        localP = geometry.matMulPtNew(p, inverseTransform),
        hitInfo, r, distSquared;
    switch (item.type) {
      case 'disk':
        r = item.radius;
        hitInfo = diagrams.hitTestDisk(0, 0, r, localP, tol);
        if (hitInfo) {
          if (diagrams.hitPoint(0, 0, localP, knobbyRadius)) {
            hitInfo.center = true;
          } else if (diagrams.hitPoint(r, 0, localP, knobbyRadius)) {
            hitInfo.resizer = true;
          } else {
            return null;
          }
        }
        break;
      case 'point':
        if (diagrams.hitPoint(0, 0, localP, tol))
          hitInfo = { position: true };
        break;
      case 'edge':
        var points = item.items, length = points.length;
        // First check the end points.
        if (!hitInfo && diagrams.hitPoint(0, 0, localP, knobbyRadius))
          hitInfo = { p1: true };
        if (!hitInfo && diagrams.hitPoint(1, 0, localP, knobbyRadius))
          hitInfo = { p2: true };
        // Now check the edge segments.
        if (!hitInfo) {
          var lastP = { x: 0, y: 0 };
          for (var i = 0; i < length; i++) {
            var pi = points[i];
            hitInfo = diagrams.hitTestLine(lastP, pi, localP, tol);
            if (hitInfo)
              break;
            lastP = pi;
          }
          if (!hitInfo)
            hitInfo = diagrams.hitTestLine(lastP, { x: 1, y: 0 }, localP, tol);
        }
        break;
      // case 'linear':
      //   hitInfo = diagrams.hitTestLine(
      //       { x:0, y:0 }, { x: item.dx, y: item.dy }, localP, tol);
      //   break;
      // case 'bezier':
      //   if (Math.abs(localP.x + item.halfLength) <= knobbyRadius + tol &&
      //       Math.abs(localP.y) <= knobbyRadius + tol)
      //     hitInfo = { end0: true };
      //   else if (Math.abs(localP.x) <= knobbyRadius + tol &&
      //            Math.abs(localP.y) <= knobbyRadius + tol)
      //     hitInfo = { mid: true };
      //   else if (Math.abs(localP.x - item.halfLength) <= knobbyRadius + tol &&
      //            Math.abs(localP.y) <= knobbyRadius + tol)
      //     hitInfo = { end1: true };
      //   else {

      //   }

      //   for (var i = 0; i < item.points.length; i++) {
      //     var pi = item.points[i];
      //     if (Math.abs(localP.x - pi.x) <= knobbyRadius + tol &&
      //         Math.abs(localP.y - pi.y) <= knobbyRadius + tol)
      //       hitInfo = { point: true, index: i };
      //   }
      //   for (var i = 0; i < item._curves.length; i++) {
      //     var curve = item._curves[i];
      //     if (geometry.hitTestCurveSegment(curve[0], curve[1], curve[2], curve[3], localP, tol))
      //       return { curve: true, index: i };
      //   }
      //   break;
      case 'group':
        if (!item.op || !item._paths)
          return;
        for (var i = 0; i < item._paths.length; i++) {
          var path = item._paths[i];
          if (geometry.pointInConvexHull(path, localP)) {
            hitInfo = { position: true };
          }
          break;
          // ctx.beginPath();
          // ctx.moveTo(path[0].x, path[0].y);
          // for (var j = 1; j < path.length; j++)
          //   ctx.lineTo(path[j].x, path[j].y);
          // ctx.closePath();
          // if (ctx.isPointInPath(localP.x, localP.y))
          //   return { position: true };
        }
        break;
    }
    if (hitInfo)
      hitInfo.item = item;
    return hitInfo;
  }

//------------------------------------------------------------------------------

  function Editor(model, renderer) {
    var self = this;
    this.model = model;
    this.board = model.root;
    this.renderer = renderer;

    this.hitTolerance = 8;

    var palette = this.palette = {
      root: {
        type: 'palette',
        x: 0,
        y: 0,
        items: [
          {
            type: 'disk',
            id: 1,
            x: 40,
            y: 40,
            radius: 16,
          },
          {
            type: 'point',
            id: 2,
            x: 80,
            y: 40,
          },
          // {
          //   type: 'linear',
          //   id : 2,
          //   x: 16,
          //   y: 72,
          //   dx: 96,
          //   dy: 0,
          // },
          // {
          //   type: 'bezier',
          //   id: 3,
          //   x: 64,
          //   y: 96,
          //   halfLength: 48,
          //   points: [
          //     { x: -24, y: 15 },
          //     { x: 0, y: 20 },
          //     { x: 24, y: 15 }
          //   ],
          // },
        ]
      }
    }
    dataModels.observableModel.extend(palette);
    dataModels.hierarchicalModel.extend(palette);
    dataModels.transformableModel.extend(palette);
    palette.dataModel.initialize();

    editingModel.extend(model);
    model.dataModel.initialize();

    this.updateGeometry(palette.root);
  }

  Editor.prototype.initialize = function(canvasController) {
    this.canvasController = canvasController;
    this.canvas = canvasController.canvas;
    this.ctx = canvasController.ctx;
    if (!this.renderer)
      this.renderer = new Renderer(canvasController.theme);
  }

  Editor.prototype.isPaletteItem = function(item) {
    var hierarchicalModel = this.palette.hierarchicalModel;
    return hierarchicalModel.getParent(item) === this.palette.root;
  }

  Editor.prototype.addTemporaryItem = function(item) {
    this.model.observableModel.changeValue(this.board, 'temporary', item);
  }

  Editor.prototype.removeTemporaryItem = function(item) {
    return this.model.observableModel.changeValue(this.board, 'temporary', null);
  }

  Editor.prototype.getTemporaryItem = function() {
    return this.board.temporary;
  }

  Editor.prototype.draw = function() {
    var renderer = this.renderer, model = this.model, ctx = this.ctx,
        palette = this.palette,
        canvasController = this.canvasController;

    this.updateGeometry();

    renderer.beginDraw(model, ctx);
    canvasController.applyTransform();
    visit(this.board, function(item) {
      renderer.drawItem(item, normalMode);
    });

    this.model.selectionModel.forEach(function(item) {
      renderer.drawItem(item, highlightMode);
    });
    if (this.hotTrackInfo)
      renderer.drawItem(this.hotTrackInfo.item, hotTrackMode);
    renderer.endDraw();

    renderer.beginDraw(palette, ctx);
    ctx.fillStyle = renderer.theme.altBgColor;
    ctx.fillRect(palette.root.x, palette.root.y, 160, 300);
    palette.root.items.forEach(function(item) {
      renderer.drawItem(item, normalMode);
    })
    renderer.endDraw();

    renderer.beginDraw(model, ctx);
    var temporary = this.getTemporaryItem();
    if (temporary) {
      canvasController.applyTransform();
      renderer.drawItem(temporary, normalMode);
    }
    renderer.endDraw();
  }

  Editor.prototype.hitTest = function(p) {
    var renderer = this.renderer,
        canvasController = this.canvasController,
        cp = canvasController.viewToCanvas(p),
        scale = canvasController.scale,
        zoom = Math.max(scale.x, scale.y),
        tol = this.hitTolerance, cTol = tol / zoom,
        hitList = [];
    function pushInfo(info) {
      if (info)
        hitList.push(info);
    }

    reverseVisit(this.palette.root, function(item) {
      pushInfo(renderer.hitTest(item, p, tol, normalMode));
    });

    // TODO hit test selection first, in selectionMode, first.
    reverseVisit(this.board, function(item) {
      pushInfo(renderer.hitTest(item, cp, cTol, normalMode));
    });
    return hitList;
  }

  function isDraggable(hitInfo, model) {
    return true;
  }

  function isUnselected(hitInfo, model) {
    var item = hitInfo.item;
    return !model.hierarchicalModel.isItemInSelection(item);
  }

  Editor.prototype.getFirstHit = function(hitList, filterFn) {
    if (hitList) {
      var model = this.model, length = hitList.length;
      for (var i = 0; i < length; i++) {
        var hitInfo = hitList[i];
        if (filterFn(hitInfo, model))
          return hitInfo;
      }
    }
    return null;
  }

  Editor.prototype.getFirstUnselectedContainerHit = function(hitList, item) {
    function filter(hitInfo, model) {
      var hitItem = hitInfo.item,
          compatible = (isEdgeItem(item) && isEdge(hitItem)) ||
                       (isHullItem(item) && isHull(hitItem));
      return compatible && isUnselected(hitInfo, model);
    }
    return this.getFirstHit(hitList, filter);
  }

  Editor.prototype.onClick = function(p) {
    var model = this.model,
        shiftKeyDown = this.canvasController.shiftKeyDown,
        hitList = this.hitTest(p),
        mouseHitInfo = this.mouseHitInfo = this.getFirstHit(hitList, isDraggable);
    if (mouseHitInfo) {
      if (!model.selectionModel.contains(mouseHitInfo.item) && !shiftKeyDown)
        model.selectionModel.clear();
      if (!this.isPaletteItem(mouseHitInfo.item))
        model.selectionModel.add(mouseHitInfo.item);
    } else {
      if (!shiftKeyDown) {
        model.selectionModel.clear();
      }
    }
    return mouseHitInfo != null;
  }

  Editor.prototype.onBeginDrag = function(p0) {
    if (!this.mouseHitInfo)
      return;
    var mouseHitInfo = this.mouseHitInfo,
        dragItem = mouseHitInfo.item,
        model = this.model,
        newItem, drag;
    if (this.isPaletteItem(dragItem)) {
      newItem = model.instancingModel.clone(dragItem);
      drag = {
        type: 'paletteItem',
        name: 'Add new ' + dragItem.type,
        isNewItem: true,
      }
      var cp = canvasController.viewToCanvas(newItem);
      newItem.x = cp.x;
      newItem.y = cp.y;
    } else {
      switch (dragItem.type) {
        case 'disk':
          if (mouseHitInfo.resizer)
            drag = { type: 'resizeDisk', name: 'Resize disk' };
          else if (mouseHitInfo.center)
            drag = { type: 'moveSelection', name: 'Move selection' };
          break;
        case 'point':
          drag = { type: 'moveSelection', name: 'Move selection' };
          break;
        case 'edge':
          // if (mouseHitInfo.pi !== undefined)
          //     drag = { type: 'pi', pi: mouseHitInfo.pi, name: 'Edit control point' };
          //   else
          if (mouseHitInfo.p1)
            drag = { type: 'p1', name: 'Edit edge' };
          else if (mouseHitInfo.p2)
            drag = { type: 'p2', name: 'Edit edge' };
          else
            drag = { type: 'moveSelection', name: 'Move selection' };
          break;
        // case 'linear':
        //   if (mouseHitInfo.p1)
        //     drag = { type: 'p1', name: 'Edit line' };
        //   else if (mouseHitInfo.p2)
        //     drag = { type: 'p2', name: 'Edit line' };
        //   else
        //     drag = { type: 'moveSelection', name: 'Move selection' }; // TODO edit position drag type
        //   break;
        // case 'bezier':
        //   if (mouseHitInfo.end0)
        //     drag = { type: 'end0', name: 'Stretch curve' };
        //   else if (mouseHitInfo.mid)
        //     drag = { type: 'mid', name: 'Attach curve' };
        //   else if (mouseHitInfo.end1)
        //     drag = { type: 'end1', name: 'Stretch curve' };
        //   else if (mouseHitInfo.point)
        //     drag = { type: 'point', name: 'Move control point' };
        //   else
        //     drag = { type: 'moveSelection', name: 'Move selection' };
        //   break;
        case 'group':
          drag = { type: 'moveSelection', name: 'Move selection' };
          break;
      }
    }
    this.drag = drag;
    if (drag) {
      if (drag.type === 'moveSelection')
        model.editingModel.reduceSelection();
      model.transactionModel.beginTransaction(drag.name);
      if (newItem) {
        drag.item = newItem;
        model.dataModel.initialize(newItem);
        this.addTemporaryItem(newItem);
      } else {
        drag.item = dragItem;
      }
    }
  }

  Editor.prototype.calcDrags = function(item, model, p, p0) {
    var parent = model.hierarchicalModel.getParent(item),
        transformableModel = model.transformableModel,
        inverseTransform = transformableModel.getInverseAbsolute(item),
        inverseParentTransform = transformableModel.getInverseAbsolute(parent),
        localClick = geometry.matMulPtNew(p0, inverseTransform),
        localMouse = geometry.matMulPtNew(p, inverseTransform),
        parentClick = geometry.matMulPtNew(p0, inverseParentTransform),
        parentMouse = geometry.matMulPtNew(p, inverseParentTransform);
    return {
      localClick: localClick,
      localMouse: localMouse,
      localDrag: { x: localMouse.x - localClick.x, y: localMouse.y - localClick.y },
      parentClick: parentClick,
      parentMouse: parentMouse,
      parentDrag: { x: parentMouse.x - parentClick.x, y: parentMouse.y - parentClick.y },
    };
  }

  Editor.prototype.projectToParentHull = function(item, p) {
    var model = this.model,
        parent = model.hierarchicalModel.getParent(item);
    if (parent && parent.type == 'group' && parent.op == 'hull') {
      var centroid = parent._centroid, hull = parent._paths[0],
          transformableModel = model.transformableModel,
          local = transformableModel.getLocal(item),
          pParent = geometry.matMulPtNew(p, local),
          pProj = geometry.projectPointToConvexHull(hull, pParent),
          angle = geometry.getAngle(pProj.x - centroid.x, pProj.y - centroid.y);
      return angle;
    }
  }

  // p is local to edge's coordinate system.
  function projectToEdgePoint(edge, p) {
    var dx = edge.dx, dy = edge.dy;
    return {
      t: geometry.projectPointToSegment({ x: 0, y: 0 }, { x: dx, y: dy }, p),
      n: (-dy * p.x + dx * p.y) / (dx * dx + dy * dy),
    }
  }

  Editor.prototype.onDrag = function(p0, p) {
    var self = this,
        drag = this.drag,
        dragItem = drag.item,
        model = this.model,
        transactionModel = model.transactionModel,
        renderer = this.renderer,
        mouseHitInfo = this.mouseHitInfo,
        snapshot = transactionModel.getSnapshot(dragItem),
        canvasController = this.canvasController,
        cp0 = canvasController.viewToCanvas(p0),
        cp = canvasController.viewToCanvas(p),
        dx = cp.x - cp0.x, dy = cp.y - cp0.y,
        drags = this.calcDrags(dragItem, model, cp, cp0),
        hitList = this.hitTest(p), hitInfo,
        newLength;

    switch (drag.type) {
      case 'paletteItem':
        var snapshot = transactionModel.getSnapshot(dragItem),
            drags = self.calcDrags(dragItem, model, cp, cp0),
            parentDrag = drags.parentDrag;
        model.observableModel.changeValue(dragItem, 'x', snapshot.x + parentDrag.x);
        model.observableModel.changeValue(dragItem, 'y', snapshot.y + parentDrag.y);
        // Find container underneath item for hot tracking.
        hitInfo = this.getFirstUnselectedContainerHit(hitList, dragItem);
        break;
      case 'moveSelection':
        model.selectionModel.forEach(function(item) {
          var snapshot = transactionModel.getSnapshot(item),
              drags = self.calcDrags(item, model, cp, cp0),
              parentDrag = drags.parentDrag;
          model.observableModel.changeValue(item, 'x', snapshot.x + parentDrag.x);
          model.observableModel.changeValue(item, 'y', snapshot.y + parentDrag.y);
        });
        if (dragItem.type == 'point' && dragItem._parent.type === 'edge') {
          var newPi = projectToEdgePoint(dragItem._parent, drags.localMouse);
          var pi = dragItem.items[drag.pi];
          model.observableModel.changeValue(pi, 't', newPi.t);
          model.observableModel.changeValue(pi, 'n', newPi.n);
        } else {
          // Find container underneath item for hot tracking.
          hitInfo = this.getFirstUnselectedContainerHit(hitList, dragItem);
        }
        break;

      case 'resizeDisk':
        var localClick = drags.localClick,
            localMouse = drags.localMouse,
            dx1 = localClick.x, dy1 = localClick.y,
            dx2 = localMouse.x, dy2 = localMouse.y;
        model.observableModel.changeValue(dragItem, 'radius',
            snapshot.radius * Math.sqrt((dx2 * dx2 + dy2 * dy2) / (dx1 * dx1 + dy1 * dy1)));
        break;

      case 'p1':
        model.observableModel.changeValue(dragItem, 'x', snapshot.x + drags.parentDrag.x);
        model.observableModel.changeValue(dragItem, 'y', snapshot.y + drags.parentDrag.y);
        model.observableModel.changeValue(dragItem, 'dx', snapshot.dx - drags.localDrag.x);
        model.observableModel.changeValue(dragItem, 'dy', snapshot.dy - drags.localDrag.y);
        // item._angle1 = this.projectToParentHull(dragItem, { x: 0, y: 0 });
        break;

      case 'p2':
        model.observableModel.changeValue(dragItem, 'dx', snapshot.dx + drags.localDrag.x);
        model.observableModel.changeValue(dragItem, 'dy', snapshot.dy + drags.localDrag.y);
        // dragItem._angle2 = this.projectToParentHull(dragItem, { x: dragItem.dx, y: dragItem.dy });
        break;

      // case 'end0':
      //   model.observableModel.changeValue(dragItem, 'x', snapshot.x + drags.parentDrag.x / 2);
      //   model.observableModel.changeValue(dragItem, 'y', snapshot.y + drags.parentDrag.y / 2);
      //   newLength = geometry.lineLength(drags.parentMouse.x, drags.parentMouse.y, dragItem.x, dragItem.y);
      //   model.observableModel.changeValue(dragItem, 'halfLength', newLength);
      //   this.autoRotateBezier(dragItem);
      //   break;

      // case 'bezier':
      //   var newLength;
      //   if (mouseHitInfo.part == 'position') {
      //     observableModel.changeValue(dragItem, 'x', snapshot.x + parent_drag.x);
      //     observableModel.changeValue(dragItem, 'y', snapshot.y + parent_drag.y);
      //     autoRotateBezier(dragItem);
      //   } else if (mouseHitInfo.part == 'point') {
      //     var pt = dragItem.points[mouseHitInfo.index];
      //     var oldPt = dragItem._points[mouseHitInfo.index];
      //     observableModel.changeValue(pt, 'x', oldPt.x + local_drag.x);
      //     observableModel.changeValue(pt, 'y', oldPt.y + local_drag.y);
      //   } else if (mouseHitInfo.part == 'end0') {
      //   } else if (mouseHitInfo.part == 'end1') {
      //     observableModel.changeValue(dragItem, 'x', snapshot.x + parent_drag.x / 2);
      //     observableModel.changeValue(dragItem, 'y', snapshot.y + parent_drag.y / 2);
      //     newLength = LineLength(parent_mouse.x, parent_mouse.y, dragItem.x, dragItem.y);
      //     autoRotateBezier(dragItem);
      //   } else if (mouseHitInfo.part == 'mid') {
      //     observableModel.changeValue(dragItem, 'x', snapshot.x + parent_drag.x);
      //     observableModel.changeValue(dragItem, 'y', snapshot.y + parent_drag.y);
      //     autoRotateBezier(dragItem);
      //   }
      //   if (newLength) {
      //     if (newLength > 0.00001) {
      //       dragItem.halfLength = newLength;
      //       var scale = newLength / snapshot.halfLength;
      //       for (var i = 0; i < dragItem.points.length; i++) {
      //         var pi = dragItem.points[i], oldPi = dragItem._points[i];
      //         observableModel.changeValue(pi, 'x', scale * oldPi.x);
      //         observableModel.changeValue(pi, 'y', scale * oldPi.y);
      //       }
      //     }
      //   }
      //   break;
    }
    this.hotTrackInfo = (hitInfo && hitInfo.item !== this.board) ? hitInfo : null;
  }

  Editor.prototype.onEndDrag = function(p) {
    var drag = this.drag,
        model = this.model,
        board = this.board,
        selectionModel = model.selectionModel,
        editingModel = model.editingModel,
        transactionModel = model.transactionModel,
        newItem = this.removeTemporaryItem();
    if (newItem) {
      // Clone the new item, since we're about to roll back the transaction. We
      // do this to collapse all of the edits into a single insert operation.
      newItem = model.instancingModel.clone(newItem);
      model.dataModel.initialize(newItem);
      transactionModel.cancelTransaction();
      transactionModel.beginTransaction(drag.name);
    }

    if (drag.type == 'moveSelection' || newItem) {
      // Find group beneath mouse.
      var dragItem = newItem || drag.item,
          hitList = this.hitTest(p),
          hitInfo = this.getFirstUnselectedContainerHit(hitList, dragItem),
          parent = hitInfo ? hitInfo.item : board;
      if (newItem) {
        var x = newItem.x, y = newItem.y;
        // Items that can't be added to the board without being wrapped in a group.
        if (parent === board && isHullItem(newItem)) {
          var group = {
            type: 'group',
            op: 'hull',
            x: x,
            y: y,
            items: [ newItem ],
          };
          model.dataModel.initialize(group);
          newItem.x = 0;
          newItem.y = 0;
          newItem = group;
        } else if (!isEdge(parent) && isEdgeItem(newItem)) {
          var edge = {
            type: 'edge',
            x: x - 32,
            y: y - 32,
            dx: 64,
            dy: 64,
            items: [
              {
                x: 0.5,
                y: 0,
              }
            ],
          }
          model.dataModel.initialize(edge);
          newItem = edge;
        }
        if (newItem && newItem.type === 'point') {
          var transformableModel = model.transformableModel;
          geometry.matMulPt(newItem, transformableModel.getInverseAbsolute(parent));
          var pi = projectToEdgePoint(parent, newItem);
          editingModel.addPoint(pi, parent);
          selectionModel.set([pi]);
        } else {
          editingModel.addItem(newItem, parent);
          selectionModel.set([newItem]);
        }
      } else {
        // Reparent items if necessary.
        selectionModel.forEach(function(item) {
          if (isHull(item))
            editingModel.addItem(item, parent);
        });
      }
    }

    transactionModel.endTransaction();

    this.drag = null;
    this.mouseHitInfo = null;
    this.hotTrackInfo = null;
  }

  // // Calculate auto-rotation using parent hull.
  // Editor.prototype.autoRotateBezier = function(item) {
  //   var model = this.model,
  //       parent = model.hierarchicalModel.getParent(item),
  //       p = { x: item.x, y: item.y };
  //   if (parent.type == 'group' && parent.op == 'hull') {
  //     var hull = parent._paths[0];
  //     var i0 = findClosestPathSegment(hull, p);
  //     var i1 = (i0 < hull.length - 1) ? i0 + 1 : 0;
  //     var t = getTurn(hull[i0].x - hull[i1].x, hull[i0].y - hull[i1].y);
  //     model.observableModel.changeValue(item, '_rotation', t * 2 * Math.PI);
  //   }
  // }

  function indices_adjacent(i1, i2, length, wraps) {
    var next = i1 + 1;
    if (wraps && next == length)
      next = 0;
    var prev = i1 - 1;
    if (wraps && prev < 0)
      prev = length - 1;
    return i2 == next || i2 == prev;
  }

  function makeInterpolatingPoints(bezier) {
    var points = [];
    var length = bezier.points.length;
    var halfLength = bezier.halfLength;
    points.push({ x: -halfLength * 2, y: 0 });
    points.push({ x: -halfLength, y: 0 });
    for (var i = 0; i < length; i++) {
      var pi = bezier.points[i];
      points.push({ x: pi.x, y: pi.y });
    }
    points.push({ x: halfLength, y: 0 });
    points.push({ x: halfLength * 2, y: 0 });
    return points;
  }

  // Paths are computed in the local space of the item, translated when combining.
  Editor.prototype.updateGeometry = function(root) {
    var self = this, model = this.model,
        hierarchicalModel = model.hierarchicalModel,
        transformableModel = model.transformableModel,
        diffPathStack = [];
    if (!root)
      root = this.board;

    function updatePass1(item) {
      if (item.type == 'group')
        diffPathStack.push(new ClipperLib.Paths());

      // Create paths for primitives.
      var path = [];
      var subdivisions, step, x, y;
      var dx, dy, cx, cy;
      switch (item.type) {
        case 'disk':
          var r = item.radius;
          subdivisions = Math.sqrt(r) * 16;
          for (var i = 0; i < subdivisions; i++) {
            x = r * Math.cos(2 * Math.PI * i / subdivisions);
            y = r * Math.sin(2 * Math.PI * i / subdivisions);
            path.push({ x: x, y: y });
          }
          break;
        case 'bezier':
          // Generate local curve for unbound bezier items.
          var parent = hierarchicalModel.getParent(item);
          if (!parent || parent.type != 'group' || parent.op != 'hull') {
            var points = makeInterpolatingPoints(item);
            item._curves = [];
            item._curveLengths = [];
            generateCurveSegments(points, item._curves, item._curveLengths);
          }
          // // Convert curves to points.
          // for (var i = 0; i < length + 1; i++) {
          //   subdivisions = item._curveLengths[i] / 4;
          //   step = 1.0 / subdivisions;
          //   var curve = item._curves[i];
          //   for (var t = 0; t < 1; t += step) {
          //     var t2 = t * t;
          //     var t3 = t2 * t;
          //     var c1 = 1 - 3 * t + 3 * t2 - t3;
          //     var c2 = 3 * t - 6 * t2 + 3 * t3;
          //     var c3 = 3 * t2 - 3 * t3;
          //     var x = c1 * curve[0].x + c2 * curve[1].x + c3 * curve[2].x + t3 * curve[3].x;
          //     var y = c1 * curve[0].y + c2 * curve[1].y + c3 * curve[2].y + t3 * curve[3].y;
          //     path.push({ x: x, y: y });
          //   }
          // }
          // // add the last curve point.
          // path.push({ x: curve[3].x, y: curve[3].y });
          // path.push({ x: 0, y: 0 });
          break;
      }

      item._paths = [ path ];

      // Add diff items to the parent item's clipper.
      if (item.diff) {
        diffPathStack[diffPathStack.length - 1].push(ToClipperPath(path, item));
      }
    }

    function updatePass2(item) {
      var points = [];
      // Now that all child items are updated, build the paths for
      // unions and hulls.
      if (item.type == 'group') {
        var diffPaths = diffPathStack.pop();
        // If there are diff paths, adjust child groups.
        // if (diffPaths.length) {
        //   var clipper = new ClipperLib.Clipper();
        //   clipper.AddPath(diffPaths, ClipperLib.PolyType.ptSubject, true);
        //   clipper.AddPaths(diffPaths, ClipperLib.PolyType.ptClip, true);
        //   var allDiffs = new ClipperLib.Paths();
        //   clipper.Execute(ClipperLib.ClipType.ctXor, allDiffs);

        //   for (var i = 0; i < item.items.length; i++) {
        //     var subItem = item.items[i];
        //     if (subItem.type == 'group') {
        //       clipper.Clear();
        //       for (var j = 0; j < subItem._paths.length; j++) {
        //         var path = subItem._paths[j];
        //         clipper.AddPath(ToClipperPath(path, subItem), ClipperLib.PolyType.ptSubject, true)
        //       }
        //       clipper.AddPaths(allDiffs, ClipperLib.PolyType.ptClip, true);
        //       var solution = new ClipperLib.Path();
        //       clipper.Execute(ClipperLib.ClipType.ctDifference, solution);
        //       if (solution.length) {
        //         subItem._paths = [];
        //         for (var j = 0; j < solution.length; j++) {
        //           var solutionPath = solution[j];
        //           var path = FromClipperPath(solutionPath, subItem);


        //           subItem._paths.push(path);
        //         }
        //       }
        //     }
        //   }
        // }

        if (item.op == 'hull') {
          var subItems = item.items;
          for (var i = 0; i < subItems.length; i++) {
            var subItem = subItems[i];
            if (!subItem.diff) {
              var localTransform = transformableModel.getLocal(subItem);
              for (var j = 0; j < subItem._paths.length; j++) {
                var path = subItem._paths[j];
                for (var k = 0; k < path.length; k++) {
                  var p = path[k];
                  p = { x: p.x, y: p.y, path: j, index: k, item: subItem };
                  geometry.matMulPt(p, localTransform);
                  points.push(p);
                }
              }
            }
          }

          var hull = geometry.getConvexHull(points, item),
              centroid = geometry.getCentroid(hull);
          geometry.annotateConvexHull(hull, centroid);
          // geometry.insetConvexHull(hull, -16);

          var subItems = item.items;
          for (var i = 0; i < subItems.length; i++) {
            var subItem = subItems[i];
            if (subItem.type == 'bezier') {
              var localTransform = transformableModel.getLocal(subItem);
              var points = makeInterpolatingPoints(subItem);
              var pointsLength = points.length;
              for (var j = 0; j < pointsLength; j++) {
                var pj = points[j];
                // control point base into parent space.
                var p0 = { x: pj.x, y: 0 };
                geometry.matMulPt(p0, localTransform);
                var seg0 = findClosestPathSegment(hull, p0);
                var seg1 = seg0 + 1;
                if (seg1 == hull.length)
                  seg1 = 0;
                var norm = { x: hull[seg1].y - hull[seg0].y, y: hull[seg0].x - hull[seg1].x };
                geometry.vecNormalize(norm);
                var height = pj.y;
                norm.x *= height;
                norm.y *= height;
                var base = projectToPath(hull, seg0, p0);
                points[j] = { x: base.x + norm.x, y: base.y + norm.y };
                geometry.matMulPt(points[j], subItem._itransform);
              }
              subItem._curves = [];
              subItem._curveLengths = [];
              generateCurveSegments(points, subItem._curves, subItem._curveLengths);
            }
          }
          item._centroid = centroid;
          item._paths = [ hull ];
        }
      }

      // Update local bounds.
      item._bounds = {};
      for (var i = 0; i < item._paths.length; i++)
        Box2d.extendArray(item._bounds, item._paths[i]);
    }

    function updatePass3(item) {
      // if (item.type == 'linear') {
      //   var parent = hierarchicalModel.getParent(item);
      //   if (parent && parent.type == 'group' && parent.op == 'hull') {
      //     if (!item._angle1)
      //       item._angle1 = self.projectToParentHull(item, { x: 0, y: 0 });
      //     if (!item._angle2)
      //       item._angle2 = self.projectToParentHull(item, { x: item.dx, y: item.dy });
      //     item._attached = true;

      //     var centroid = parent._centroid, hull = parent._paths[0],
      //         inverseLocal = transformableModel.getInverseLocal(item),
      //         p1 = geometry.angleToConvexHull(hull, centroid, item._angle1),
      //         p2 = geometry.angleToConvexHull(hull, centroid, item._angle2);
      //     item._p1 = geometry.matMulPt(p1, inverseLocal),
      //     item._p2 = geometry.matMulPt(p2, inverseLocal);
      //   }
      // }

    }

    visit(root, updatePass1);
    visit(root, updatePass2);
    visit(root, updatePass3);
  }

  Editor.prototype.onKeyDown = function(e) {
    var model = this.model, board = this.board,
        selectionModel = model.selectionModel,
        editingModel = model.editingModel,
        transactionHistory = model.transactionHistory,
        keyCode = e.keyCode,
        cmdKey = e.ctrlKey || e.metaKey,
        shiftKey = e.shiftKey;

    if (keyCode == 8) {  // 'delete'
      editingModel.doDelete();
      return true;
    }
    if (cmdKey) {
      switch (keyCode) {
        case 65:  // 'a'
          board.items.forEach(function(v) {
            selectionModel.add(v);
          });
          return true;
        case 90:  // 'z'
          if (transactionHistory.getUndo()) {
            selectionModel.clear();
            transactionHistory.undo();
            return true;
          }
          return false;
        case 89:  // 'y'
          if (transactionHistory.getRedo()) {
            selectionModel.clear();
            transactionHistory.redo();
            return true;
          }
          return false;
        case 88:  // 'x'
          editingModel.doCut();
          return true;
        case 67:  // 'c'
          editingModel.doCopy();
          return true;
        case 86:  // 'v'
          if (editingModel.getScrap()) {
            editingModel.doPaste();
            return true;
          }
          return false;
        case 83:  // 's'
          var text = JSON.stringify(
            board,
            function(key, value) {
              if (key.toString().charAt(0) === '_')
                return;
              if (value === undefined || value === null)
                return;
              return value;
            },
            2);
          // Writes board as JSON to console.
          console.log(text);
          return true;
      }
    }
  }

  return {
    editingModel: editingModel,
    Renderer: Renderer,
    Editor: Editor,
  };
})();



var shape_data = {
  "type": "group",
  "x": 0,
  "y": 0,
  "id": 153,
  "items": [
    {
      "type": "group",
      "op": "hull",
      "x": 440.41165005344783,
      "y": 272.24185446499,
      "items": [
        {
          "type": "disk",
          "x": -95.13906402102225,
          "y": -117.9973685422255,
          "radius": 139.92260819176386,
          "id": 181
        },
        {
          "type": "disk",
          "x": -133.47291806630716,
          "y": 640.7190082602278,
          "radius": 16,
          "id": 183
        },
        {
          "type": "disk",
          "x": 367.6976551872644,
          "y": 644.1873674119423,
          "radius": 16,
          "id": 184
        },
        {
          "type": "disk",
          "x": 414.81855352447116,
          "y": -165.79329996043995,
          "radius": 66.90411048657579,
          "id": 185
        },
        {
          "type": "group",
          "op": "hull",
          "x": 37.95365879771731,
          "y": 322.99615794203424,
          "items": [
            {
              "type": "disk",
              "x": 6,
              "y": -7,
              "radius": 16,
              "id": 210
            },
            {
              "type": "disk",
              "x": -48,
              "y": -36,
              "radius": 34.04715277226595,
              "id": 211
            },
            {
              "type": "disk",
              "x": -65,
              "y": -151,
              "radius": 16,
              "id": 212
            }
          ],
          "id": 213
        },
        {
          "type": "group",
          "op": "hull",
          "x": -65.03845921360232,
          "y": -58.64494158800758,
          "items": [
            {
              "type": "disk",
              "x": 216.7962951626671,
              "y": 5.37036130133734,
              "radius": 39.505914005112075,
              "id": 224
            }
          ],
          "id": 225
        },
        {
          "type": "group",
          "op": "hull",
          "x": 447.9615407863978,
          "y": 83.35505841199242,
          "items": [
            {
              "type": "disk",
              "x": -185.1219171549967,
              "y": -100.69520711250829,
              "radius": 40.23684148848271,
              "id": 222
            }
          ],
          "id": 223
        },
        {
          "type": "group",
          "op": "hull",
          "x": 447.9615407863978,
          "y": 83.35505841199242,
          "items": [
            {
              "type": "disk",
              "x": -292.6487668619987,
              "y": -20.73342644300908,
              "radius": 40.23684148848271,
              "id": 220
            }
          ],
          "id": 221
        },
        {
          "type": "group",
          "op": "hull",
          "x": 545.9615407863978,
          "y": 151.35505841199242,
          "items": [
            {
              "type": "disk",
              "x": -276.5578098740084,
              "y": -53.25205523000221,
              "radius": 40.23684148848271,
              "id": 218
            }
          ],
          "id": 219
        },
        {
          "type": "group",
          "op": "hull",
          "x": -84.66303838092938,
          "y": 542.4223620264428,
          "items": [
            {
              "type": "disk",
              "x": 73,
              "y": -118,
              "radius": 18.161224791664853,
              "id": 214
            },
            {
              "type": "disk",
              "x": 138.6095294796001,
              "y": -137.39939716017415,
              "radius": 25.475244635370935,
              "id": 215
            },
            {
              "type": "disk",
              "x": 184,
              "y": -92,
              "radius": 16,
              "id": 216
            }
          ],
          "id": 217
        },
        {
          "type": "group",
          "op": "hull",
          "x": 283.88068826809933,
          "y": 380.55431903307965,
          "items": [
            {
              "type": "disk",
              "x": -112,
              "y": 0,
              "radius": 16,
              "id": 206
            },
            {
              "type": "disk",
              "x": -48,
              "y": -36,
              "radius": 34.04715277226595,
              "id": 207
            },
            {
              "type": "disk",
              "x": -29.750868624734267,
              "y": -140.5005790831562,
              "radius": 16,
              "id": 208
            }
          ],
          "id": 209
        },
        {
          "type": "group",
          "op": "hull",
          "x": -115.77560606625855,
          "y": -139.44031417303614,
          "items": [
            {
              "type": "disk",
              "x": 2.4499156637059514,
              "y": 0.9799662654823464,
              "radius": 9.929778600166998,
              "id": 226
            },
            {
              "type": "disk",
              "x": 2.407409674665587,
              "y": 81.85192893863245,
              "radius": 10.333627809386586,
              "id": 228
            }
          ],
          "id": 227
        },
        {
          "type": "group",
          "op": "hull",
          "x": -56.48764700457684,
          "y": -160.0196057481653,
          "items": [
            {
              "type": "disk",
              "x": 2.4499156637059514,
              "y": 0.9799662654823464,
              "radius": 9.929778600166998,
              "id": 232
            },
            {
              "type": "disk",
              "x": 2.407409674665587,
              "y": 81.85192893863245,
              "radius": 10.333627809386586,
              "id": 233
            }
          ],
          "id": 234
        },
        {
          "type": "group",
          "op": "hull",
          "x": 1.3303626588814268,
          "y": -176.67903226136517,
          "items": [
            {
              "type": "disk",
              "x": 2.4499156637059514,
              "y": 0.9799662654823464,
              "radius": 9.929778600166998,
              "id": 235
            },
            {
              "type": "disk",
              "x": 2.407409674665587,
              "y": 81.85192893863245,
              "radius": 10.333627809386586,
              "id": 236
            }
          ],
          "id": 237
        },
        {
          "type": "disk",
          "x": -177.62046231828322,
          "y": -43.74962683659891,
          "radius": 85.98177053809061,
          "id": 239
        },
        {
          "type": "group",
          "op": "hull",
          "x": -892.8800168746304,
          "y": 810.299112751308,
          "items": [
            {
              "type": "disk",
              "x": 955.8344124036056,
              "y": -207.521920002481,
              "radius": 7.317260635772668,
              "id": 247
            },
            {
              "type": "disk",
              "x": 900.3863586530567,
              "y": -231.64009517673122,
              "radius": 16.638179481930923,
              "id": 250
            }
          ],
          "id": 248
        },
        {
          "type": "group",
          "op": "hull",
          "x": -676.2068957780594,
          "y": 808.7738596021206,
          "items": [
            {
              "type": "disk",
              "x": 845.3844452872089,
              "y": -203.3652008099284,
              "radius": 7.317260635772668,
              "id": 254
            },
            {
              "type": "disk",
              "x": 900.3863586530567,
              "y": -231.64009517673122,
              "radius": 16.638179481930923,
              "id": 255
            }
          ],
          "id": 256
        },
        {
          "type": "disk",
          "x": -70.03021975522722,
          "y": 680.3217284237408,
          "radius": 16,
          "id": 257
        }
      ],
      "id": 182
    }
  ]
}
