import pages = require("ui/page");
import gestures = require("ui/gestures");
import cameraModule = require("camera");
import grid = require("ui/layouts/grid-layout");
import absolute = require("ui/layouts/absolute-layout");
import imageSource = require("image-source");
import image = require("ui/image");
import listView = require("ui/list-view");

import utils = require("utils/utils");

import billvm = require("./bill-view-model");

import observable = require("data/observable");
import observableArray = require("data/observable-array");

var page;
var billImageView: image.Image;
var selectionContainer: absolute.AbsoluteLayout;
var selection: grid.GridLayout;
var density: number;
var imageScale: number = 1;

var bill = new billvm.Bill();

// Event handler for Page "loaded" event attached in main-page.xml
export function pageLoaded(args: observable.EventData) {
    // Get the event sender
    page = <pages.Page>args.object;
    // page.bindingContext = null;
    density = utils.layout.getDisplayDensity();
    billImageView = <image.Image>page.getViewById("billImageView");
    selectionContainer = <absolute.AbsoluteLayout>page.getViewById("selection-container");
    selection = <grid.GridLayout> page.getViewById("selection");

    if (selectionContainer.android) {
        selectionContainer.android.setOnTouchListener(new android.view.View.OnTouchListener({
            onTouch: containerTouch
        }));
    }
    else if (selectionContainer.ios) {
        selectionContainer.observe(gestures.GestureTypes.pan, containerPan);
    }

    page.bindingContext = bill;
}


export function addImageButtonTap() {
    cameraModule.takePicture().then(picture => {
        console.log("Result is an image source instance");
        billImageView.imageSource = picture;
        computeScale();
    });
}

export function remove(e) {
    bill.removeProduct(e.object.bindingContext);
}

function computeScale() {
    // var imageBounds = (<any>billImageView)._getCurrentLayoutBounds();
    // var actualWidth = imageBounds.right - imageBounds.left;
    // var actualHeight = imageBounds.bottom - imageBounds.top;
    // console.log("imageBounds: " + JSON.stringify(imageBounds));
    var actualWidth = selectionContainer.getMeasuredWidth();
    var actualHeight = selectionContainer.getMeasuredHeight();
    var imageWidth = billImageView.imageSource.width;
    var imageheight = billImageView.imageSource.height;
    console.log("actual " + actualWidth + ", " + actualHeight + " image " + imageWidth + ", " + imageheight);
    imageScale = Math.min(actualWidth / imageWidth, actualHeight / imageheight);
    console.log("imageScale " + imageScale);
}

// Selection
function containerTouch(view: android.view.View, motionEvent: android.view.MotionEvent) {
    var x = motionEvent.getX() / density;
    var y = motionEvent.getY() / density;
    switch (motionEvent.getAction()) {
        case android.view.MotionEvent.ACTION_DOWN:
            panStarted(x, y);
            break;

        case android.view.MotionEvent.ACTION_MOVE:
            panMoving(x - selX, y - selY);
            break;

        case android.view.MotionEvent.ACTION_UP:
            panEnded();
            break;
    }

    return true;
}

function containerPan(args: gestures.PanGestureEventData) {
    if (args.ios) {
        switch (args.ios.state) {
            case UIGestureRecognizerState.UIGestureRecognizerStateBegan:
                var point = args.ios.locationInView(args.view.ios);
                panStarted(point.x, point.y);
                break;

            case UIGestureRecognizerState.UIGestureRecognizerStateChanged:
                panMoving(args.deltaX, args.deltaY);
                break;

            case UIGestureRecognizerState.UIGestureRecognizerStateEnded:
                panEnded();
                break;
        }
    }
}

var selX: number;
var selY: number;
var selW: number;
var selH: number;

function panStarted(x: number, y: number) {
    selX = x;
    selY = y;
    selW = 0;
    selH = 0;
    selection.borderWidth = 1;
    updateSelection();
}

function panMoving(x: number, y: number) {
    selW = x;
    selH = y;
    updateSelection();
}

function panEnded() {
    selection.borderWidth = 0;
    cropImage();
}

function updateSelection() {
    var left = selX - (selW > 0 ? 0 : -selW);
    var top = selY - (selH > 0 ? 0 : -selH)

    //console.log("selection[" + left + ", " + top + ", " + selW + ", " + selH + "]");
    absolute.AbsoluteLayout.setTop(selection, top);
    absolute.AbsoluteLayout.setLeft(selection, left);
    selection.width = Math.abs(selW);
    selection.height = Math.abs(selH);
}

function cropImage() {
    var imgSrc = billImageView.imageSource;
    if (!imgSrc) {
        return;
    }

    var left = (selX - (selW > 0 ? 0 : -selW)) * density / imageScale;
    var top = (selY - (selH > 0 ? 0 : -selH)) * density / imageScale;
    var width = (Math.abs(selW)) * density / imageScale;
    var height = (Math.abs(selH)) * density / imageScale;

    // validate
    left = Math.max(0, left);
    top = Math.max(0, top);
    width = Math.min(imgSrc.width - left, width);
    height = Math.min(imgSrc.height - top, height);

    var croppedImageSource;
    if (billImageView.ios) {
        var rect = CGRectMake(left, top, width, height);
        var imageRef = CGImageCreateWithImageInRect(billImageView.ios.image.CGImage, rect);
        var uiImage = UIImage.imageWithCGImage(imageRef);
        croppedImageSource = imageSource.fromNativeSource(uiImage);
        CGImageRelease(imageRef);
    }
    else if (imgSrc.android) {
        var croppedBitmap = android.graphics.Bitmap.createBitmap(imgSrc.android, left, top, width, height)
        croppedImageSource = imageSource.fromNativeSource(croppedBitmap);
    }

    bill.addFromImage(croppedImageSource);
}
