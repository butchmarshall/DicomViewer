var DicomViewer = function(config) {
	config = ((typeof(config) != "object") ? {} : config);

	var that = this,
	data = (config.data || []),
	target = (config.target || null),
	width = (config.width || 400),
	height = (config.height || 400),
	onReady = (config.onReady || function() {}),
	dicom_index = 0;

	// DicomImage
	this.DicomImage = function(datum, maxWidth, maxHeight, onReady) {
		onReady = ((typeof(onReady) != "function") ? function() {} : onReady);
		var that = this;

		that.xOffset = 0;
		that.yOffset = 0;

		that.canvas = document.createElement("canvas");
		that.buffer = [];
		that.max = -Infinity;
		that.min = Infinity;
		that.width = 0;
		that.height = 0;

		that.window = 0;
		that.level = 0;

		var size = Math.pow(2, 8);

		try {
			that.resize_lookup = new Float32Array(size);
		}
		catch(e) {
			that.resize_lookup = new Array(size);
		}

		try {
			that.offset_lookup = new Uint8ClampedArray(that.resize_lookup.length);
		}
		catch(e) {
			that.offset_lookup = new Array(that.resize_lookup.length);
		}

		for(var i=0; i < that.resize_lookup.length; ++i) {
			that.resize_lookup[i] = i;
		}

		that.setWindowLevelMinMax = function(min, max) {
			var level = (max - min);
			var window = (min + level/2);
			// set window level
			that.setWindowAndLevel(window, level);
		}

		that.offsetWindowAndLevel = function(w, l) {
			w = that.window + w;
			l = that.level + l;

			var center = (w - 0.5),
			width = (l - 1),
			dispval = null;

			for(var i=0; i< that.offset_lookup.length; ++i)
			{
				dispval = ((that.resize_lookup[i] - center ) / width + 0.5) * 255;
				that.offset_lookup[i] = parseInt(dispval, 10);
			}
		};

		that.setWindowAndLevel = function(w, l) {
			that.window = w;
			that.level = l;

			var center = (that.window - 0.5),
			width = (that.level - 1),
			dispval = null;

			for(var i=0; i< that.offset_lookup.length; ++i)
			{
				dispval = ((that.resize_lookup[i] - center ) / width + 0.5) * 255;
				that.offset_lookup[i] = parseInt(dispval, 10);
			}
		};

		that.recalculateImageData = function(array) {
			var size = (that.width * that.height),
			rpos = (0 * 3 * size),
			gpos = ((0 * 3 * size) + 1),
			bpos = ((0 * 3 * size) + 2);

			var i = 0;
			for(var j = 0; j < size; j++) {
				array.data[i] = parseInt((that.offset_lookup[that.buffer[rpos]]), 10);
				array.data[i+1] = parseInt((that.offset_lookup[that.buffer[gpos]]), 10);
				array.data[i+2] = parseInt((that.offset_lookup[that.buffer[bpos]]), 10);
				array.data[i+3] = 0xff;
				i += 4;

				rpos += 3;
				gpos += 3;
				bpos += 3;
			}
		};

		that._drawing = false;
		that._drawStack = [];
		that.draw = function(onComplete) {
			if (typeof(onComplete) == "function") {
				that._drawStack.push(onComplete);
			}
			if (!that._drawing) {
				that._drawing = true;
				// Firefox has severe draw lag - always wait for a previous draw to finish before continuing
				setTimeout(function() {
					var buffer = document.createElement('canvas');
					buffer.width = that.imageData.width;
					buffer.height = that.imageData.height;

					that.recalculateImageData(that.imageData);

					buffer.getContext('2d').putImageData(that.imageData, 0, 0);

					that.canvas.width = that.imageData.width;
					that.canvas.height = that.imageData.height;
					that.canvas.getContext("2d").drawImage(buffer, 0, 0);

					// When drawing is finished
					var func;
					while(func = that._drawStack.shift()) {
						func.call(that);
					}

					that._drawing = false;
				}, 0);
			}
		};

		that.loadImageData = function(src, callback) {
			var img = document.createElement("img"),
			canvas = document.createElement("canvas"),
			context = canvas.getContext("2d");

			img.setAttribute("src", src);
			img.addEventListener('load', function() {
				var width = this.width,
				height = this.height,
				ratio = Math.max((maxWidth/width), (maxHeight/height));

				// Resize the image to the max width/height we need - anything more makes calculations slow
				width = width*ratio;
				height = height*ratio;
				
				canvas.width = width;
				canvas.height = height;

				context.drawImage(this, 0, 0, this.width, this.height, 0, 0, width, height);

				callback(context.getImageData(0, 0, width, height));
			}, false);
		};

		// Load ImageData
		that.loadImageData(datum.src, function(data) {
			that.imageData = data;
			that.width = that.imageData.width;
			that.height = that.imageData.height;

			// Calculate min and max
			var j = 0, value = 0;
			for (var i = 0; i < that.imageData.data.length; i+=4) {
				that.buffer[j] = that.imageData.data[i];
				that.buffer[j+1] = that.imageData.data[i+1];
				that.buffer[j+2] = that.imageData.data[i+2];
				j+=3;
			}

			for(var i=0; i < that.buffer.length; i++) {    
				value = that.buffer[i];
				if( value > that.max ) { that.max = value; }
				if( value < that.min ) { that.min = value; }
			}

			that.setWindowLevelMinMax(that.min, that.max);

			that.draw();
			onReady.call(that)
		});

		return that;
	};

	that.xOffset = 0;
	that.yOffset = 0;

	that.data = data;
	that.dicoms = new Array(data.length);
	that.dicom = null;

	that.canvas = document.createElement("canvas");
	that.canvas.style.display = 'block';
	that.canvas.setAttribute("width", width);
	that.canvas.setAttribute("height", height);
	that.canvasContext = that.canvas.getContext('2d');

	that.dom = document.createElement("span");
	that.dom.style.display = 'inline-block';
	that.dom.style.position = 'relative';
	that.dom.style.fontFamily = 'sans';
	that.dom.style.color = "#ffffff";

	that.dom.appendChild(that.canvas);

	var topRightText = document.createElement("span"),
	topLeftText = document.createElement("span"),
	bottomRightText = document.createElement("span"),
	bottomLeftText = document.createElement("span");

	topRightText.style.cursor = 'default';
	topRightText.style.WebkitUserSelect = 'none';
	topRightText.style.position = 'absolute';
	topRightText.style.margin = '1.0em';

	topLeftText.style.cursor = 'default';
	topLeftText.style.WebkitUserSelect = 'none';
	topLeftText.style.position = 'absolute';
	topLeftText.style.margin = '1.0em';

	bottomRightText.style.cursor = 'default';
	bottomRightText.style.WebkitUserSelect = 'none';
	bottomRightText.style.position = 'absolute';
	bottomRightText.style.margin = '1.0em';

	bottomLeftText.style.cursor = 'default';
	bottomLeftText.style.WebkitUserSelect = 'none';
	bottomLeftText.style.position = 'absolute';
	bottomLeftText.style.margin = '1.0em';

	topRightText.style.top = '0px';
	topLeftText.style.top = '0px';
	bottomRightText.style.bottom = '0px';
	bottomLeftText.style.bottom = '0px';
	topRightText.style.right = '0px';
	bottomRightText.style.right = '0px';
	topLeftText.style.left = '0px';
	bottomLeftText.style.left = '0px';

	topRightText.style.textAlign = 'right';
	topLeftText.style.textAlign = 'left'
	bottomRightText.style.textAlign = 'right'
	bottomLeftText.style.textAlign = 'left'
	
	that.dom.appendChild(topRightText);
	that.dom.appendChild(topLeftText);
	that.dom.appendChild(bottomRightText);
	that.dom.appendChild(bottomLeftText);

	that.setText = function(text, position) {
		if (position == 'top-right') {
			topRightText.innerHTML = text;
		}
		else if (position == 'top-left') {
			topLeftText.innerHTML = text;
		}
		else if (position == 'bottom-right') {
			bottomRightText.innerHTML = text;
		}
		else if (position == 'bottom-left') {
			bottomLeftText.innerHTML = text;
		}
	};

	that.getWidth = function() {
		return parseInt(that.canvas.getAttribute('width'));
	};

	that.getHeight = function() {
		return parseInt(that.canvas.getAttribute('height'));
	};

	that.loader = (function() {
		var canvas = document.createElement("canvas"),
		context = canvas.getContext('2d'),
		width = 50, height = 50;

		canvas.setAttribute("width", width);
		canvas.setAttribute("height", height);

		var targetWidth = 0, targetData,
		targetContext = that.canvas.getContext('2d'),
		targetHeight = 0,
		interval = null,
		started = null,
		draw = function() {
			targetHeight = that.getHeight();
			targetWidth = that.getWidth();

			var sinceStarted = (new Date() - started) / 1000;
			context.save();
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			context.translate((width/2), (height/2));
			context.rotate(Math.PI * 2 * sinceStarted);
			for (var i = 0; i < 16; i++) {
				context.rotate(Math.PI * 2 / 12);
				context.beginPath();
				context.moveTo(4, 0);
				context.lineTo(8, 0);
				context.strokeStyle = "rgba(255,255,255," + i / 12 + ")";
				context.stroke();
			}
			context.restore();

			targetContext.putImageData(targetData, 0, 0);

			targetContext.fillStyle = "rgba(50, 50, 50, 0.5)";
			targetContext.fillRect(0, 0, targetWidth, targetHeight);

			targetContext.drawImage(canvas, 0, 0, width, height, (targetWidth/2)-(width/2), (targetHeight/2)-(height/2), width, height);
		};

		return {
			start: function() {
				targetHeight = that.getHeight();
				targetWidth = that.getWidth();

				targetData = targetContext.getImageData(0, 0, targetWidth, targetHeight);

				started = new Date();
				interval = window.setInterval(draw, 1000 / 30);
			},
			stop: function() {
				window.clearInterval(interval);
				targetContext.putImageData(targetData, 0, 0);
			}
		};
	})();

	var attachEvents = function() {
		var dragging = false,
		startX = 0, startY = 0,
		xOffsetStart = 0, yOffsetStart = 0;

		that.canvas.addEventListener("mousedown", function(e) {
			dragging = true;
			xOffsetStart = that.xOffset;
			yOffsetStart = that.yOffset;
			startX = e.pageX;
			startY = e.pageY;
		});
		window.addEventListener("mouseup", function(e) {
			dragging = false;
		});
		window.addEventListener("mousemove", function(e) {
			if (dragging) {
				var offsetX = parseInt(startX - e.pageX),
				offsetY = parseInt(startY - e.pageY);

				that.xOffset = (xOffsetStart-offsetX);
				that.yOffset = (yOffsetStart-offsetY);

				that.draw();
			}
		});
	};

	// Load image data
	that.loader.start();
	var load_count = 0;
	for(var i = 0; i < data.length; i++) {
		(function(i, datum) {
			setTimeout(function() {
				new that.DicomImage(datum, config.width, config.height, function() {
					load_count++;
					that.dicoms.splice(i, 1, {
						datum: datum,
						dicom_image: this
					});
					if (load_count == that.data.length) {
						that.setDicom(that.dicoms[0]);

						onReady.call(that);
						attachEvents();

						that.draw();
						that.loader.stop();
					}
				});
			}, 0);
		})(i, data[i]);
	}

	that.setDicom = function(dicom) {
		that.dicom = dicom;

		that.setText(that.dicom.datum.text_top_right || "", "top-right");
		that.setText(that.dicom.datum.text_top_left || "", "top-left");
		that.setText(that.dicom.datum.text_bottom_right || "", "bottom-right");
		that.setText(that.dicom.datum.text_bottom_left || "", "bottom-left");

		that.canvasContext.clearRect(0, 0, that.getWidth(), that.getHeight());
		that.draw();
	}

	that.nextDicom = function() {
		dicom_index++;
		if (dicom_index > that.dicoms.length-1) {
			dicom_index = 0;
		}
		that.setDicom(that.dicoms[dicom_index]);
	};

	that.previousDicom = function() {
		dicom_index--;
		if (dicom_index < 0) {
			dicom_index = that.dicoms.length-1;
		}
		that.setDicom(that.dicoms[dicom_index]);
	};

	that._drawing = false;
	that.draw = function() {
		if (!that._drawing) {
			that._drawing = true;

			setTimeout(function() {
				that.dicom.dicom_image.offsetWindowAndLevel(that.xOffset, that.yOffset);

				var sourceWidth, targetWidth, ratio = 1, offsetLeft = 0, offsetTop = 0, destWidth = 0, destHeight = 0,
				targetHeight = parseInt(that.canvas.offsetHeight),
				targetWidth = parseInt(that.canvas.offsetWidth);

				// Only copy once finished drawing
				that.dicom.dicom_image.draw(function() {
					sourceWidth = parseInt(that.dicom.dicom_image.canvas.getAttribute("width")),
					sourceHeight = parseInt(that.dicom.dicom_image.canvas.getAttribute("height"));

					ratio = targetWidth / sourceWidth;
					if ((targetWidth/sourceWidth)*sourceHeight > targetHeight) {
						ratio = targetHeight / sourceHeight;
					}

					destWidth = parseInt(sourceWidth*ratio);
					destHeight = parseInt(sourceHeight*ratio);

					offsetLeft = (targetWidth-destWidth)/2;
					offsetTop = (targetHeight-destHeight)/2;

					var c = that.dicom.dicom_image.offset_lookup[0];
					that.dom.style.color = "rgba("+(255-c)+", "+(255-c)+", "+(255-c)+", 1)";
					that.canvasContext.fillStyle = "rgba("+c+", "+c+", "+c+", 1)";
					that.canvasContext.fillRect(0, 0, targetWidth, targetHeight);

					that.canvasContext.drawImage(that.dicom.dicom_image.canvas, 0, 0, sourceWidth, sourceHeight, offsetLeft, offsetTop, destWidth, destHeight);

					that._drawing = false;
				});

			}, 0);
		}
	};
};