import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    status:"connecting",
    pumpMessage:"",
    disconnectEvents:[],
    devices:[],
    deviceStatus:{},
    topics:[],
    error:null,
}
const webSocketSlice = createSlice({
    name:"websocket",
    initialState,
    reducers:{
        setStatus:(state,action)=>{
            state.status = action.payload
        },
        setPumpMessage: (state,action)=>{
            state.pumpMessage = action.payload
        },
        addDisconnectEvent: (state, action) => {
            state.disconnectEvents.unshift(action.payload);
        },
        setTopics:(state,action)=>{
            state.topics = action.payload;
        },
        setError: (state, action) => {
        state.error = action.payload;
        },
        setDevices:(state,action)=>{
            state.devices = action.payload
        },
        setDevicesStatus:(state,action)=>{
            const {device,status} = action.payload;
            state.deviceStatus[device] = status;
        },
        resetWebSocket: () => initialState,
    
    }
});

export const {
    setStatus,
    setPumpMessage,
    addDisconnectEvent,
    setError,
    resetWebSocket,
    setDevices,
    setDevicesStatus,
    setTopics,
    resetTopics
} = webSocketSlice.actions;

export default webSocketSlice.reducer;