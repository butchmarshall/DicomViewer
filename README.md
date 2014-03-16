DicomViewer
===

A canvas based image viewer that provides windowing and leveling.

    var dicom_viewer = new DicomViewer({
      data: [
        {
            src: "//image.com/file.jpg"
	    }
      ],
      width: 800,
      height: 600
    });
    document.getElementById("target_element").appendChild(dicom_viewer.dom);

You can view a [demo](http://butchmarshall.github.io/DicomViewer).