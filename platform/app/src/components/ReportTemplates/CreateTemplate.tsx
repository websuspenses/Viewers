import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
  maxWidth: '1070px',
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
  const nodeAppHost = process.env.REACT_APP_HOST_NAME;
  const clientId = window.config.oidc[0].client_id;


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
  const [subModality, setUpdateSubModality] = useState('');
  const [updateTemplateInfo, setUpdateTemplateInfo] = useState([]);
  const [authHeaders, setAuthHeaders] = useState('');
  const [rolesInfo, setuserRoles] = useState('');
  const [subscriptionFeatures, setLabsubsInfo] = useState('');
  const labId = sessionStorage.getItem('labId') || '';

  useEffect(() => {

    console.log("local headers ", authHeaders);
    if (authHeaders) {
      fetch(`${nodeAppHost}/read_modalities/${labId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'Content-Type': 'application/json',
          'isAccess': 'read_modalities',
          'labId': labId,
          'userSub': sessionStorage.getItem('user_sub') || ''
        },
      })
        .then(response => response.json())
        .then(actualData => {
          console.log('Modalities list Info ', actualData);
          setModalityOptionsList(actualData.data);
        })
        .catch(err => {
          console.log(err.message);
        });
    }

  }, [authHeaders]);

  useEffect(() => {
    const sessInfo = JSON.parse(sessionStorage.getItem(`oidc.user:${window.config.oidc[0].authority}:${window.config.oidc[0].client_id}`));
    let authHeaders = sessInfo.token_type + ' ' + sessInfo.access_token;
    console.log("local headers ", authHeaders);
    setAuthHeaders(authHeaders);
    setuserRoles(sessInfo.profile?.realm_access?.roles);

    // Read labsubsinfo from sessionStorage
    const storedLabsubsInfo = sessionStorage.getItem('labsubsinfo') || '';
    setLabsubsInfo(storedLabsubsInfo);
  }, []);

  useEffect(() => {
    if (modalityValue && authHeaders) {
      console.log("local headers --> read_study_template ", authHeaders);
      fetch(`${nodeAppHost}/read_study_template/${labId}/${templateValue}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'Content-Type': 'application/json',
          'isAccess': 'read_study_template',
          'labId': labId,
          'userSub': sessionStorage.getItem('user_sub') || ''
        },
      })
        .then(response => response.json())
        .then(actualData => {
          console.log('Modality Info ', actualData, actualData.data[0].template_content);
          setUpdateModality(actualData.data);
          setUpdateSubModality(actualData && actualData.data[0].sub_modality);
          setUpdateTemplateInfo(actualData && actualData.data[0].template_content);
        })
        .catch(err => {
          console.log(err.message);
        });
    }
  }, [modalityValue, authHeaders]);

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  const isShowFeature = (value) => {
    let finalResult = false;
    //console.log("subscriptionFeatures ", subscriptionFeatures, "rolesInfo ", rolesInfo);
    if (subscriptionFeatures && rolesInfo) {
      finalResult = subscriptionFeatures.includes(value) && rolesInfo.includes(value);
    }
    console.log("subscriptionFeatures ", subscriptionFeatures, "rolesInfo ", rolesInfo, "finalResult ", finalResult);
    return finalResult;
  };

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
  const handelChangeSubModality = event => {
    console.log(" Before Sub Modality ", subModality);
    setUpdateSubModality(event.target.value);
    console.log(" After Sub Modality ", subModality);
  };
  const handleSubmit = event => {
    console.log("form values  ", event.target.input);
    event.preventDefault();
    // Handle form submission with selectedOption
    let contentValue = '';
    console.log('contentRef.current.innerHTML', value);
    if (contentRef.current) {
      contentValue = contentRef.current.innerHTML;
    }
    console.log('labName', labName, 'Selected option:', selectedOption, 'contentRef ', value, "subModality ", subModality);

    if (!modalityValue && !templateValue) {
      const url = `${nodeAppHost}/create_template`;

      const data = { modality: selectedOption, template_content: value, lab_id: labId, sub_modality: subModality };
      const options = {
        method: 'POST',
        headers: {
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'Content-Type': 'application/json',
          'isAccess': 'add_report_template',
          'labId': labId,
          'userSub': sessionStorage.getItem('user_sub') || ''
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
      //let authHeaders = localStorage.getItem('auth-t');
      const data = { modality: selectedOption, template_content: value, sub_modality: subModality };
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeaders,
          'clientId': clientId,
          'realm': clientId,
          'isAccess': 'add_report_template',
          'labId': labId,
          'userSub': sessionStorage.getItem('user_sub') || ''
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
  const handleRedirectPage = () => {
    navigate('/report-templates');
  }

  return (
    <div>
      <Header
        isSticky
        menuOptions={[]}
        isReturnEnabled={false}
        WhiteLabeling={{}}
        isActive={isActive}
        handleChange={handleChangeSwitch}
        handleRedirectPage={handleRedirectPage}
        screen="ReportTemplateList"
      />

      {isShowFeature('add_report_template') && <div className="templateForm">
        <h1 className="doctors-list-title">
          {modalityValue ? 'Update Template' : 'Create Template'}
        </h1>
        <form onSubmit={handleSubmit} >
          <div style={{ display: 'grid', justifyContent: 'center' }}>
            <div className="modalityDropdown">
              <label htmlFor="dropdown">Modality</label>
              <select
                name="selectedOption"
                disabled={modalityValue && modalityValue !== '' ? true : false}
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
            <div className="subModality">
              <p>
                <span>Sub Modality</span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter Sub Modality"
                  name="sub_Modality"
                  value={subModality}
                  onChange={handelChangeSubModality}
                />
              </p>
            </div>
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
      </div>}
      {!isShowFeature('add_report_template') && <div className="noAccessCls"><h1>Access Denied</h1>
        <p>Sorry, you do not have the necessary permissions to view this page.</p>
        <p>If you believe this is a mistake, please contact the administrator.</p>
        <p><Link
          to="/workList"
        >
          <li>
            <span>Go Back to Home</span>
          </li>
        </Link></p></div>}
    </div>
  );
};


export default CreateTemplate;
