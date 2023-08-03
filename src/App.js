/*global chrome*/

import React from 'react';

import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import CreatableSelect from 'react-select/creatable';
import { useState, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import * as commands from '@uiw/react-md-editor/lib/commands';
import { Remarkable } from 'remarkable';
import './App.css';


const COLOR = {
  textSlate200: "rgb(226 232 240/1)",

}

const t2 = (() => {
  const languages = ['js', 'rust', 'ts', 'php', 'bash'];
  const output = [];
  const shortcuts = {
    js: 'cmd+j',
    rust: 'cmd+r',
    ts: 'cmd+shift+t',
    php: 'cmd+shift+p',
    bash: 'cmd+sh',
  };

  for (const l of languages) {
    output.push({
      name: `${l}`,
      keyCommand: `${l}`,
      buttonProps: { 'aria-label': `${l}` },
      shortcuts: `${shortcuts[l]}`,
      icon: <span>{l}</span>,
      execute: (state, api) => {
        let modifyText = `\`\`\`${l}\n ${state.selectedText} \n\`\`\`\n `;
        if (!state.selectedText) {
          modifyText = `\`\`\`${l}\n\n \`\`\` `;
        }
        api.replaceSelection(modifyText);
      },
    });
  }
  return output;
})();


function App({ document, window, isExt }) {
  //for cleanup make use of zustand
  const [value, setValue] = useState('**Hello world!!!**');
  const [views, setViews] = useState('**Store Views!!!**');
  const [isPublic, setIsPublic] = useState(true);
  const [valueOp, setValueOp] = useState([]);
  const [mainTopic, setMainTopic] = useState()
  const [subTopic, setSubTopic] = useState()
  const [note, setNote] = useState()
  // static state only updated during loading
  const [username, setUsername] = useState({ username: "", accessToken: "" })
  const [data, setData] = useState([])
  const [directoryStructure, setDirectoryStructure] = useState([])
  const [tags, setTags] = useState([])

  // state for when user have a bookmarked page
  const [existUrl, setExistUrl] = useState(null)
  const [viewsOrNote, setViewsOrNote] = useState("None")
  const commitState = useRef(null)
  const errRef = useRef(null)
  const [userNotes, setUserNotes] = useState([])
  const [err, setErr] = useState(null)
  const [youtube, setYoututbe] = useState(null)


  const apiBaseUrl = 'https://www.scatterednote.com';

  const md = new Remarkable();
  useEffect(() => {

    chrome.runtime.onMessage.addListener(
      function (request, sender, sendResponse) {
        if (request.message === "set_login_state") {
          setUsername(request.data.userData)
          setExistUrl(request.data.noteData)

          if (request.data.noteData) {
            setValue("") // remove previous note
            setViews("")
            setViewsOrNote("None")
          }
        }
        else if (request.message === "login") {
          if (request.status === "success") {
            setUsername(request.data)
          }
          else {
            setErr("Failed to fetch login details: redirecting to the main site to login")
            window.open(`${apiBaseUrl}`, '_blank');
          }
        }
        else if (request.message === "youtube_data") {
          setYoututbe(request.data)
          setValue(request.data.link)
          setViewsOrNote("notes")
        }
      }
    );
    // document.addEventListener('copy', function (event) {
    //   // Access the copied text using the Clipboard API
    //   const clipboardData = event.clipboardData || window.clipboardData;
    //   const copiedText = clipboardData.getData('text');
    //   setValue(copiedText)
    // });

    if (!username.username) {
      chrome.runtime.sendMessage({ message: "get_login_state" });
    }

    return () => {
      chrome.runtime.onMessage.removeListener(
        function (request, sender, sendResponse) {
          if (request.message === "set_login_state") {
            setUsername(request.data.userData)
            setExistUrl(request.data.noteData)
          }
          else if (request.message === "login") {
            if (request.status === "success") {
              setUsername(request.data)
            }
            else {
              setErr("Failed to fetch login details: redirecting to the main site to login")
              window.open(`${apiBaseUrl}`, '_blank');
            }
          }
          else if (request.message === "youtube_data") {
            setYoututbe(request.data)
            setValue(request.data.link)
            setViewsOrNote("notes")

          }
        }
      );
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/userdirectory?username=${username.username}`);
        const { data, directoryStructure, tags } = await response.json();
        setData(data)
        setDirectoryStructure(directoryStructure)
        setTags(tags)
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    if (username.username) {
      fetchData();
    }
  }, [username]);

  const handleToggle = () => {
    setIsPublic(!isPublic);
  };

  const notes = () => {
    if (subTopic && directoryStructure[subTopic.value]) {
      if (directoryStructure[subTopic.value].files.length > 0) {
        return directoryStructure[subTopic.value].files
      }
      else {
        return []
      }
    }

    if (mainTopic && directoryStructure[mainTopic.value]) {
      if (directoryStructure[mainTopic.value].files.length > 0) {
        return directoryStructure[mainTopic.value].files
      }
      else {
        return []
      }
    }
    return []
  }

  const handleCommit = async () => {
    //get all necessary state
    if (mainTopic?.label && note?.label) {
      setErr(null)
      commitState.current.textContent = 'Committing...';
      const data = {
        MainTopic: mainTopic.label,
        SubTopic: subTopic?.label,
        note: note.label,
        grab: value,
        views: views,
        isPublic: isPublic,
        user: username.username,
        tags: valueOp.map((item) => item.value),
        websiteUrl: existUrl?.url || window.location.href
      }

      //capture url to prevent tab conflict
      await chrome.runtime.sendMessage({ message: "save_tab_id", data: JSON.stringify({ url: data.websiteUrl }) })

      fetch(`${apiBaseUrl}/api/commitv2`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${username.accessToken}`,
          'X-Username': username.username,
        },
        body: JSON.stringify(data)
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to save note.");
          }
          commitState.current.textContent = 'Committed';
          chrome.runtime.sendMessage({ message: "save_data", data: JSON.stringify({ mainTopic: data.MainTopic, subTopic: data.SubTopic, note: data.note, url: data.websiteUrl }) });
        })
        .catch(error => {
          commitState.current.textContent = 'Failed';
          commitState.current.style.backgroundColor = 'red';
          errRef.current.textContent = error.message;
          console.error(error);
        });
    } else {
      setErr("Please select a Main Topic and note title")
    }

  }
  if (!username.username) {
    return (
      <div className='App w-full h-full'>
        {err && <div className="prose mt-8 bg-red-400 text-white p-4 mx-auto w-[90%]">{err}</div>}
        <div className='flex flex-col justify-center items-center w-full p-4 200 h-full'>
          <h1 className=" font-extrabold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Welcome To ScatteredNote</h1>
          <button className=' w-full rounded-lg bg-blue-500 p-8'
            onClick={async () => {
              await chrome.runtime.sendMessage({
                message: "login_data",
              })
            }}
          >LOGIN</button>
        </div>

      </div>

    )
  }

  if (existUrl && viewsOrNote === "None") {
    return (
      <div className='App w-full h-full '>
        <h1 className=" font-extrabold tracking-light text-2xl mb-4 w-full text-center" style={{ color: `${COLOR.textSlate200}` }}>ScatteredNote</h1>
        <div className='flex flex-col justify-center items-center w-full p-4 200 h-full'>
          <button className='text-lg w-full rounded-lg bg-blue-500 p-8 text-white mb-4'
            onClick={(e) => {
              e.target.textContent = "Loading..."
              const url = `${apiBaseUrl}/api/fetchnote?user=${username.username}&slug=${existUrl.mainTopic}${existUrl?.subTopic ? "/" + existUrl.subTopic + "/" : "/"}${existUrl.note.split(".json")[0]}`
              fetch(url, {
                method: 'GET',
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${username.accessToken}`,
                  "X-Username": username.username
                }
              })
                .then(response => response.json())
                .then(response => {
                  setUserNotes(response)
                })
                .catch(err => console.log(err))
              setViewsOrNote("view")
            }}>
            view existing note
          </button>
          <button className='text-lg w-full rounded-lg bg-blue-500 p-8 text-white'
            onClick={(e) => {

              setViewsOrNote("note")
            }}

          >
            Add New Note
          </button>
        </div>
      </div>
    );
  }

  if (existUrl && viewsOrNote === "view") {
    return (
      <div className='App w-full h-fullbg-slate-900 text-slate-400 '
        style={{
          backgroundColor: "rgb(15 23 42 / 1)",
          color: "rgb(148 163 184 /1)"
        }}
      >
        <h1 className=" font-extrabold tracking-light text-2xl mb-2 text-center w-full" style={{ color: `${COLOR.textSlate200}` }}>ScatteredNote</h1>
        <div className='flex justify-center items-center mb-4'>
          <button className='w-fit py-2 px-4' onClick={() => setViewsOrNote("notes")}>Take another note</button>
        </div>
        <div className='mt-20 text-left'>
          {userNotes.map((value, index) => {
            return (
              <>
                <div key={index} className='mb-4'>
                  {value.grab.includes("youtu.be") ?
                    <div className='mb-2 flex  items-center p-2 rounded-lg border-2 bg-black'>
                      <span className='text-white'>{value.grab}</span>
                      <button className='ml-2 w-6 h-6 bg-white' onClick={() => {
                        chrome.runtime.sendMessage({ message: "PLAY_b", data: parseInt(value.grab.split("t=")[1]) })
                      }}><img src={chrome.runtime.getURL("/media/play.png")} className='w-fit h-fit' alt='play'></img></button>
                    </div> :
                    (<div className=' p-2 bg-white text-black rounded-lg  font-mono font-light mb-6 border-[1px]' dangerouslySetInnerHTML={{ __html: md.render(value.grab) }} />)}
                  <div className=' p-2  bg-black text-white rounded-lg font-mono font-light mb-10 w-[75%] ml-auto' style={{ width: "90%" }} dangerouslySetInnerHTML={{ __html: md.render(value.views) }} />
                </div>

              </>
            )
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="App bg-slate-900 text-slate-400 " style={{
      backgroundColor: "rgb(15 23 42 / 1)",
      color: "rgb(148 163 184 /1)"
    }
    }>
      {err && <div className="prose mt-8 bg-red-400 text-white p-4 mx-auto w-[90%]">{err}</div>}
      <h1 className=" font-extrabold tracking-light text-2xl mb-2 text-center" style={{ color: `${COLOR.textSlate200}` }}>ScatteredNote</h1>
      <div className="mx-auto w-11/12 mt-10 grid grid-cols-1 !bg-slate-900 !text-slate-400">
        <div className="">
          <div className="mt-8 w-full">
            <h1 className=" font-bold tracking-light text-2xl" style={{ color: `${COLOR.textSlate200}` }}>Main Topic &nbsp;
              {Array.isArray(data) && data?.length ? "" :
                <svg className='text-green-200' width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="4" cy="12" r="3" fill="green">
                    <animate id="spinner_jObz" begin="0;spinner_vwSQ.end-0.25s" attributeName="r" dur="0.75s" values="3;.2;3" />
                  </circle>
                  <circle cx="12" cy="12" r="3" fill="green">
                    <animate begin="spinner_jObz.end-0.6s" attributeName="r" dur="0.75s" values="3;.2;3" />
                  </circle>
                  <circle cx="20" cy="12" r="3" fill="green">
                    <animate id="spinner_vwSQ" begin="spinner_jObz.end-0.45s" attributeName="r" dur="0.75s" values="3;.2;3" />
                  </circle>
                </svg>
              }
            </h1>
            <small className='text-sm'><i>Use an Existing Topic  or create a new Topic by just typing out the name and click on the drop down selection &ldquo;Create ...&rdquo;</i></small>
            <div className='w-full ' style={{ all: "initial" }}>
              <CreatableSelect
                options={existUrl ? [{ label: existUrl.mainTopic, value: existUrl.mainTopic }] : data}
                value={mainTopic}
                onChange={(newValue) => setMainTopic(newValue)}
                isSearchable={existUrl ? false : true}
                // isDisabled={data?.length ? false : true}
                isLoading={data?.length ? false : true}
              />
            </div>
          </div>
          <div className="mt-8 w-full">
            <h1 className=" font-bold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Sub Topic</h1>
            <small className='text-sm'><i>Use an Existing subtopic or create a new subtopic by just typing out the name and click on the drop down selection &ldquo;Create ...&rdquo;</i></small>
            <div className='w-full ' style={{ all: "initial" }}>
              <CreatableSelect
                options={
                  existUrl ? [{ label: existUrl.subTopic, value: existUrl.subTopic }] :
                    (mainTopic && directoryStructure[mainTopic.value] ? directoryStructure[mainTopic.value].directory : [])}
                value={subTopic}
                onChange={(newValue) => setSubTopic(newValue)}
                isSearchable={existUrl ? false : true}
                isDisabled={data?.length ? false : true}
              />
            </div>
          </div>
          <div className="mt-8 w-full">
            <h1 className=" font-bold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Notes</h1>
            <small className='text-sm'><i>Use an Existing Note  or create a new Note by just typing out the name and click on the drop down selection &ldquo;Create ...&rdquo;</i></small>
            <div className='w-full ' style={{ all: "initial" }}>
              <CreatableSelect
                options={existUrl ? [{ label: existUrl.note, value: existUrl.note }] : notes()}
                value={note}
                onChange={(newValue) => setNote(newValue)}
                isSearchable={existUrl ? false : true}
                isDisabled={data?.length ? false : true}
              />
            </div>
          </div>

          {/* <div className="flex items-center relative mt-8">
            <small className='absolute top-0'><i>Make a new note public or private</i></small>
            <br />
            <label
              htmlFor="toggle"
              className="flex items-center cursor-pointer mt-10"
            >
              <div className="relative">
                <input
                  id="toggle"
                  type="checkbox"
                  className="sr-only"
                  checked={!isPublic}
                  onChange={handleToggle}
                />
                <div
                  className={`block ${isPublic ? 'bg-green-400' : 'bg-gray-600'
                    } w-14 h-8 rounded-full transition duration-300`}
                ></div>
                <div
                  className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition duration-300 ${isPublic ? 'transform translate-x-full' : ''
                    }`}
                ></div>
              </div>
              <div className="ml-3 text-gray-700 font-medium">
                {isPublic ? 'Public' : 'Private'}
              </div>
            </label>
          </div> */}
        </div>
        <div className=" my-4">
          <section className="flex flex-col">
            <h1 className=" font-bold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Grab Editor</h1>
            {youtube ? (
              <div className='flex justify-center items-center p-2 rounded-lg border-2 bg-black'>
                <span className='text-white'>{youtube.link}</span>
                <button className='ml-2 w-6 h-6 bg-white' onClick={() => {
                  chrome.runtime.sendMessage({ message: "PLAY_b", data: youtube.timestamp })
                }}><img src={chrome.runtime.getURL("/media/play.png")} className='w-fit h-fit' alt='play'></img></button>
              </div>
            )
              : (<MDEditor
                value={value}
                onChange={setValue}
                height={400}
                commands={[
                  commands.bold,
                  commands.italic,
                  commands.strikethrough,
                  commands.hr,
                  commands.title,
                  commands.divider,
                  commands.link,
                  commands.quote,
                  commands.code,
                  commands.codeBlock,
                  commands.image,
                  commands.group([...t2], {
                    name: 'language',
                    groupName: 'language',
                    buttonProps: { 'aria-label': 'Insert a language' },
                    icon: <span>language</span>,
                  }),
                  commands.divider,
                  commands.orderedListCommand,
                  commands.unorderedListCommand,
                  commands.checkedListCommand,
                ]}
                extraCommands={[
                  commands.codeEdit,
                  commands.codePreview,
                  commands.codeLive,
                ]}
              />)}
          </section>
          <section className="flex flex-col mt-4">
            <h1 className=" font-bold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Note</h1>
            <MDEditor
              value={views}
              onChange={setViews}
              height={400}
              commands={[
                commands.bold,
                commands.italic,
                commands.strikethrough,
                commands.hr,
                commands.title,
                commands.divider,
                commands.link,
                commands.quote,
                commands.code,
                commands.codeBlock,
                commands.image,
                commands.group([...t2], {
                  name: 'language',
                  groupName: 'language',
                  buttonProps: { 'aria-label': 'Insert a language' },
                  icon: <span>language</span>,
                }),
                commands.divider,
                commands.orderedListCommand,
                commands.unorderedListCommand,
                commands.checkedListCommand,
              ]}
              extraCommands={[
                commands.codeEdit,
                commands.codePreview,
                commands.codeLive,
              ]}
            />
          </section>

          <section className="flex flex-col mt-4 mb-4">
            <h1 className=" font-bold tracking-light text-2xl mb-2" style={{ color: `${COLOR.textSlate200}` }}>Tags</h1>
            <div className='w-full ' style={{ all: "initial" }}>
              <CreatableSelect
                isMulti options={tags}
                value={valueOp}
                onChange={(newValue) => setValueOp(newValue)}
              />
            </div>
          </section>

          <div>
            <button
              ref={commitState}
              className='px-4 py-2 bg-green-400 text-white rounded-md mt-8 mx-auto float-right'
              onClick={() => handleCommit()}
            >
              Commit
            </button>
            {errRef?.current?.textContent && <div className="prose mt-8 bg-red-400 text-white" ref={errRef}></div>}
          </div>

        </div>

      </div>
    </div >
  );
}

export default App;
