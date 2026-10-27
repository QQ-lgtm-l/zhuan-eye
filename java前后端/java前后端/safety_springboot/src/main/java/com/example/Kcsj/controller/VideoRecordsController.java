package com.example.Kcsj.controller;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.Message;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.entity.VideoRecords;
import com.example.Kcsj.entity.WorkOrder;
import com.example.Kcsj.handler.MessageWebSocketHandler;
import com.example.Kcsj.mapper.MessageMapper;
import com.example.Kcsj.mapper.UserMapper;
import com.example.Kcsj.mapper.VideoRecordsMapper;
import com.example.Kcsj.mapper.WorkOrderMapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/videoRecords")
public class VideoRecordsController {
    @Resource
    VideoRecordsMapper videoRecordsMapper;
    @Resource
    WorkOrderMapper workOrderMapper;
    @Resource
    MessageMapper messageMapper;
    @Resource
    UserMapper userMapper;

    // Unicode转义字符串解码
    private String decodeUnicode(String str) {
        if (str == null) return null;
        Pattern pattern = Pattern.compile("\\\\u([0-9a-fA-F]{4})");
        Matcher matcher = pattern.matcher(str);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            char c = (char) Integer.parseInt(matcher.group(1), 16);
            matcher.appendReplacement(buffer, String.valueOf(c));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    @GetMapping("/all")
    public Result<?> GetAll() {
        return Result.success(videoRecordsMapper.selectList(null));
    }
    @GetMapping("/{id}")
    public Result<?> getById(@PathVariable int id) {
        System.out.println(id);
        return Result.success(videoRecordsMapper.selectById(id));
    }

    @GetMapping
    public Result<?> findPage(@RequestParam(defaultValue = "1") Integer pageNum,
                              @RequestParam(defaultValue = "10") Integer pageSize,
                              @RequestParam(defaultValue = "") String search,
                              @RequestParam(defaultValue = "") String search1,
                              @RequestParam(defaultValue = "") String search3,
                              @RequestParam(defaultValue = "") String search2) {
        LambdaQueryWrapper<VideoRecords> wrapper = Wrappers.<VideoRecords>lambdaQuery();
        wrapper.orderByDesc(VideoRecords::getStartTime);
        if (StrUtil.isNotBlank(search)) {
            wrapper.like(VideoRecords::getUsername, search);
        }
        if (StrUtil.isNotBlank(search1)) {
            wrapper.like(VideoRecords::getStartTime, search1);
        }
        if (StrUtil.isNotBlank(search2)) {
            wrapper.like(VideoRecords::getWeight, search2);
        }
        if (StrUtil.isNotBlank(search3)) {
            wrapper.like(VideoRecords::getConf, search3);
        }
        Page<VideoRecords> Page = videoRecordsMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return Result.success(Page);
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable int id) {
        videoRecordsMapper.deleteById(id);
        return Result.success();
    }

    @PostMapping("/update")
    public Result<?> updates(@RequestBody VideoRecords videoRecords) {
        videoRecordsMapper.updateById(videoRecords);
        return Result.success();
    }


    @PostMapping
    public Result<?> save(@RequestBody VideoRecords videoRecords) {
        System.out.println("视频记录保存请求: " + videoRecords);

        // 兜底：如果hazardLevel为null，根据label推断隐患等级并回写到实体
        if (videoRecords.getHazardLevel() == null || videoRecords.getHazardLevel().isEmpty()) {
            String label = videoRecords.getLabel();
            if (label != null && !label.isEmpty() && !label.contains("未检测到")) {
                String defaultLevel = "一般隐患";
                String decodedLabel = decodeUnicode(label);
                if (decodedLabel.contains("未佩戴安全帽")) {
                    defaultLevel = "重大隐患";
                } else if (decodedLabel.contains("车辆") || decodedLabel.contains("机械")) {
                    defaultLevel = "较大隐患";
                }
                videoRecords.setHazardLevel(defaultLevel);
                System.out.println("兜底设置hazardLevel=" + defaultLevel);
            }
        }

        videoRecordsMapper.insert(videoRecords);

        String label = videoRecords.getLabel();
        String hazardLevel = videoRecords.getHazardLevel();
        String suggestion = videoRecords.getSuggestion();

        if (label != null && !label.isEmpty() && !label.contains("未检测到")) {
            try {
                // 解码Unicode转义字符串
                String decodedLabel = decodeUnicode(label);
                
                JSONArray labels = JSONArray.parseArray(decodedLabel);
                String hiddenType = labels != null && !labels.isEmpty() ? labels.getString(0) : "未知隐患";

                // 再次确保解码
                hiddenType = decodeUnicode(hiddenType);

                if (hazardLevel == null || hazardLevel.isEmpty()) {
                    hazardLevel = "一般隐患";
                }

                // 使用Flask返回的suggestion，如果为空则生成默认建议
                String workSuggestion = suggestion;
                if (workSuggestion == null || workSuggestion.isEmpty()) {
                    workSuggestion = "请立即整改，加强现场安全管理。";
                }

                WorkOrder workOrder = new WorkOrder();
                workOrder.setOrderNo("WO" + new SimpleDateFormat("yyyyMMddHHmmss").format(new Date()));
                workOrder.setHiddenType(hiddenType);
                workOrder.setLevel(hazardLevel);
                workOrder.setLocation("施工现场");
                workOrder.setDescription("视频检测到安全隐患：" + hiddenType);
                workOrder.setResponsible("施工班组长");
                workOrder.setDeadline("24小时");
                workOrder.setStatus("pending");
                workOrder.setSuggestion(workSuggestion);
                workOrder.setCreateTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
                workOrder.setUpdateTime(workOrder.getCreateTime());
                workOrder.setRecordId(videoRecords.getId());
                workOrderMapper.insert(workOrder);

                // 根据隐患等级确定推送角色（与图像检测逻辑一致）
                List<String> pushRoles = new ArrayList<>();
                if ("重大隐患".equals(hazardLevel)) {
                    pushRoles.add("管理员");
                    pushRoles.add("项目经理");
                    pushRoles.add("专职安全员");
                } else if ("较大隐患".equals(hazardLevel)) {
                    pushRoles.add("项目经理");
                    pushRoles.add("专职安全员");
                    pushRoles.add("巡检员");
                } else {
                    pushRoles.add("专职安全员");
                    pushRoles.add("巡检员");
                    pushRoles.add("施工班组长");
                }

                LambdaQueryWrapper<User> userWrapper = Wrappers.<User>lambdaQuery();
                userWrapper.in(User::getRole, pushRoles);
                List<User> users = userMapper.selectList(userWrapper);

                List<String> userIds = new ArrayList<>();
                for (User user : users) {
                    userIds.add(user.getUsername());

                    Message message = new Message();
                    message.setUserId(user.getUsername());
                    message.setType("warning");
                    message.setTitle(hazardLevel + "预警");
                    message.setContent("视频检测到" + hiddenType + "，请及时处理！");
                    message.setCreateTime(workOrder.getCreateTime());
                    message.setIsRead(0);
                    message.setWorkOrderId(workOrder.getId());
                    messageMapper.insert(message);
                }

                JSONObject pushMessage = new JSONObject();
                pushMessage.put("type", "new_message");
                pushMessage.put("title", hazardLevel + "预警");
                pushMessage.put("content", "视频检测到" + hiddenType + "，请及时处理！");
                pushMessage.put("hazardLevel", hazardLevel);
                pushMessage.put("hiddenType", hiddenType);
                pushMessage.put("workOrderId", workOrder.getId());
                pushMessage.put("createTime", workOrder.getCreateTime());
                MessageWebSocketHandler.sendMessageToMultipleUsers(userIds, pushMessage.toJSONString());
                
                System.out.println("视频检测工单创建成功: hiddenType=" + hiddenType + ", hazardLevel=" + hazardLevel);
            } catch (Exception e) {
                System.err.println("视频检测创建工单和消息失败: " + e.getMessage());
                e.printStackTrace();
            }
        }

        return Result.success();
    }
}
