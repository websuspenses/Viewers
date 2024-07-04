import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import '../ReportTemplates/report.css';
import { Header } from '@ohif/ui';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  align,
  font,
  fontColor,
  fontSize,
  formatBlock,
  hiliteColor,
  horizontalRule,
  lineHeight,
  list,
  paragraphStyle,
  table,
  template,
  textStyle,
  image,
  link
} from "suneditor/src/plugins";

const defaultFonts = [
  'Arial',
  'Comic Sans MS',
  'Courier New',
  'Impact',
  'Georgia',
  'Tahoma',
  'Trebuchet MS',
  'Verdana',
];

const sortedFontOptions = [
  'Logical',
  'Salesforce Sans',
  'Garamond',
  'Sans-Serif',
  'Serif',
  'Times New Roman',
  'Helvetica',
  ...defaultFonts,
].sort();

let addOnPlugins1 = {

  align,
  image,
  template

};
const editorOptions = {
  showPathLabel: false,
  minHeight: "50vh",
  maxHeight: "50vh",
  placeholder: "Enter your text here!!!",
  plugins: [addOnPlugins1],
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['paragraphStyle', 'blockquote'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['fontColor', 'hiliteColor', 'textStyle'],
    ['removeFormat'],
    ['outdent', 'indent'],
    ['align', 'horizontalRule', 'list', 'lineHeight'],
    ['table', 'link', 'image'],
    ['fullScreen', 'showBlocks', 'codeView'],
    ['preview', 'print', 'save'],
  ],
  formats: ["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"],
  font: [
    "Arial",
    "Calibri",
    "Comic Sans",
    "Courier",
    "Garamond",
    "Georgia",
    "Impact",
    "Lucida Console",
    "Palatino Linotype",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS"
  ],
  colorList: [
    [
      '#828282',
      '#FF5400',
      '#676464',
      '#F1F2F4',
      '#FF9B00',
      '#F00',
      '#fa6e30',
      '#000',
      'rgba(255, 153, 0, 0.1)',
      '#FF6600',
      '#0099FF',
      '#74CC6D',
      '#FF9900',
      '#CCCCCC',
    ]
  ],
}
const CreateTemplate = () => {
  const navigate = useNavigate();

  let labName = 'Test CT Scan Center';
  const nodeAppHost = '/teleapp';

  labName = labName.replace(/ /g, '_') + '.json';
  const params = useParams();
  console.log('Default param ', params);
  const editorRef = useRef();
  const contentRef = useRef();
  const [value, setValue] = useState('<p>sample info</p>');
  const [isActive, setIsActive] = useState(false);

  const modalityValue = params.modality;
  const templateValue = params.template_id;

  const [modalityInfo, getModalityData] = useState('');
  const [modalityParam, setModalityParam] = useState('');
  const [selectedOption, setSelectedOption] = useState(modalityValue ? modalityValue : '');
  const [modalityOptionsList, setModalityOptionsList] = useState([]);
  const [updateModality, setUpdateModality] = useState([]);
  const [updateTemplateInfo, setUpdateTemplateInfo] = useState('');
  const labId = 2;

  useEffect(() => {
    //fetch(`${nodeAppHost}/read_modalities`)
    let authHeaders = localStorage.getItem('auth-t');
    console.log("local headers ", authHeaders);
    fetch(`${nodeAppHost}/read_modalities`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaders
      },
    })
      .then(response => response.json())
      .then(actualData => {
        console.log('Modality Info ', actualData);
        setModalityOptionsList(actualData.data);
      })
      .catch(err => {
        console.log(err.message);
      });
  }, []);

  useEffect(() => {
    if (modalityValue) {
      // fetch(`${nodeAppHost}/read_study_template/${labId}/${templateValue}`)
      let authHeaders = localStorage.getItem('auth-t');
      console.log("local headers --> read_study_template ", authHeaders);
      fetch(`${nodeAppHost}/read_study_template/${labId}/${templateValue}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeaders
        },
      })
        .then(response => response.json())
        .then(actualData => {
          console.log('Modality Info ', actualData);
          setUpdateModality(actualData.data);
          setUpdateTemplateInfo(actualData && actualData.data[0].template_content);
        })
        .catch(err => {
          console.log(err.message);
        });
    }
  }, [modalityValue]);

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      document.body.classList.remove('bg-black');
      document.body.classList.add('bg-black-on');
      document.body.classList.remove('reportsList_ContainerCls');
    } else {
      document.body.classList.add('reportsList_ContainerCls');
      document.body.classList.remove('bg-black-on');
      document.body.classList.add('bg-black');
    }
  }, [isActive]);

  useEffect(() => {
    const items = JSON.parse(localStorage.getItem('active_dark'));
    if (items) {
      setIsActive(items);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('active_dark', JSON.stringify(isActive));
    document.body.classList.remove('bg-black');
  }, [isActive]);

  useEffect(() => {
    console.log(editorRef.current);
  }, []);

  useEffect(() => {
    if (value !== '') {
      console.log('contentRef.current.innerHTML', contentRef, value);
      if (!contentRef.current) {
        return;
      }

      contentRef.current.innerHTML = value;
    }
  }, [value]);

  const onChangeHandler = content => {
    console.log('content', content);
    setValue(content);
  };

  // function onImageUploadBefore() {
  //   return (files, _info, _core, uploadHandler) => {
  //     console.log("Files ", files);
  //       const formData = new FormData();
  //      let data= formData.append("file", files[0]);

  //       const options = {
  //         method: 'POST',
  //         body: JSON.stringify(data),
  //       };
  //      const res = fetch("http://localhost:3300/create",options);

  //       console.log("Result",res);
  //   };
  // }
  function handleImageUploadBefore(files, info, uploadHandler) {
    // uploadHandler is a function
    console.log(files, info);
    let fileresult = getBase64(files[0]);
    return fileresult;
  }
  function getBase64(file) {
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {
      console.log('reader.result: ', reader.result);
      return reader.result;
    };
    reader.onerror = function (error) {
      console.log('Error: ', error);
    };
  }
  const imageUploadHandler = (xmlHttpRequest, info, core) => {
    console.log("Image upload handler --->", xmlHttpRequest, info, core)
  }
  function handleChangeSwitch() {
    setIsActive(!isActive);
  }
  const handleSelectChange = event => {
    setSelectedOption(event.target.value);
  };
  const handleSubmit = event => {
    event.preventDefault();
    // Handle form submission with selectedOption
    let contentValue = '';
    console.log('contentRef.current.innerHTML', value);
    if (contentRef.current) {
      contentValue = contentRef.current.innerHTML;
    }
    console.log('labName', labName, 'Selected option:', selectedOption, 'contentRef ', value);

    if (!modalityValue && !templateValue) {
      let authHeaders = localStorage.getItem('auth-t');
      const url = `${nodeAppHost}/create_template`;

      const data = { modality: selectedOption, template_content: value, lab_id: 2 };
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders
        },
        body: JSON.stringify(data),
      };

      try {
        const res = fetch(url, options);
        if (res) {
          console.log('res', res);
          navigate('/report-templates');
        }
        //const json = res.json();
        console.log('response ', res);
      } catch (error) {
        console.error('Error:', error);
      }
    } else {
      const url = `${nodeAppHost}/update_template`;
      let authHeaders = localStorage.getItem('auth-t');
      const data = { modality: selectedOption, template_content: value };
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders
          // Add any additional headers if needed
        },
        body: JSON.stringify(data),
      };

      try {
        const res = fetch(url, options);
        if (res) {
          console.log('res', res);
          navigate('/report-templates');
        }
        //const json = res.json();
        console.log('response ', res);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  };

  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        screen="ReportTemplateList"
      />
      <div className="templateForm">
        <h1 className="templateHeaderCls">
          {modalityValue ? 'Update Template' : 'Create Template'}
        </h1>
        <form onSubmit={handleSubmit} >
          <div style={{ display: 'grid', justifyContent: 'center' }}>
            <div className="modalityDropdown">
              <label htmlFor="dropdown">Modality:</label>
              <select
                name="selectedOption"
                disabled={modalityInfo && modalityInfo !== '' ? true : false}
                id="dropdown"
                value={selectedOption}
                onChange={handleSelectChange}
              >
                <option value="">Select</option>
                {modalityOptionsList.map((option, index) => (
                  <option
                    key={index}
                    value={option.modality_name}
                  >
                    {option.modality_description}
                  </option>
                ))}
              </select>
            </div>
            {/* <SunEditor
              setOptions={editorOptions}
              onImageUploadBefore={handleImageUploadBefore}
              onChange={onChangeHandler}
            /> */}
            <SunEditor
              autoFocus={true}
              lang="en"
              setOptions={editorOptions}
              onChange={onChangeHandler}
              ref={editorRef}
              setContents={modalityValue ? updateTemplateInfo : modalityInfo}
            />
            
            <button
              className="submitButton"
              type="submit"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTemplate;
