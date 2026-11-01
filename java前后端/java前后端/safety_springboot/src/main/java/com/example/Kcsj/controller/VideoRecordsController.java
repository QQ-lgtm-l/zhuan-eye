package com.example.Kcsj.controller;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.Kcsj.common.HazardLevel;
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
import java.util.Calendar;
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

        // 兜底：如果hazardLevel为null，根据label推断四级隐患并回写到实体
        if (videoRecords.getHazardLevel() == null || videoRecords.getHazardLevel().isEmpty()) {
            String label = videoRecords.getLabel();
            if (label != null && !label.isEmpty() && !label.contains("未检测到")) {
                String defaultLevel = "Ⅲ级一般";
                String decodedLabel = decodeUnicode(label);
                if (decodedLabel.matches(".*(临边|洞口|基坑|高支模|起重|倾覆|坍塌|堆载|超高|动火|高处抛物).*")) {
                    defaultLevel = "Ⅰ级重大";
                } else if (decodedLabel.matches(".*(安全带|连墙件|安全网|电缆|线缆|机械|车辆|灭火器|火灾|触电).*")) {
                    defaultLevel = "Ⅱ级较大";
                } else if (decodedLabel.matches(".*(标识|保洁|文明|垃圾).*")) {
                    defaultLevel = "Ⅳ级轻微";
                }
                videoRecords.setHazardLevel(defaultLevel);
                System.out.println("兜底设置hazardLevel=" + defaultLevel);
            }
        }
        String normalizedLevel = HazardLevel.normalize(videoRecords.getHazardLevel());
        videoRecords.setHazardLevel(normalizedLevel);
        videoRecordsMapper.insert(videoRecords);

        String label = videoRecords.getLabel();
        String hazardLevel = normalizedLevel;
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
                    hazardLevel = "Ⅲ级一般";
                }
                hazardLevel = HazardLevel.normalize(hazardLevel);

                // 使用Flask返回的suggestion，如果为空则生成默认建议
                String workSuggestion = suggestion;
                if (workSuggestion == null || workSuggestion.isEmpty()) {
                    workSuggestion = "请立即整改，加强现场安全管理。";
                }

                String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
                WorkOrder workOrder = new WorkOrder();
                workOrder.setOrderNo("WO" + new SimpleDateFormat("yyyyMMddHHmmss").format(new Date()));
                workOrder.setHiddenType(hiddenType);
                workOrder.setLevel(hazardLevel);
                workOrder.setLocation("施工现场");
                workOrder.setDescription("视频检测到安全隐患：" + hiddenType);
                workOrder.setResponsible(HazardLevel.defaultResponsible(hazardLevel));
                workOrder.setDeadline(HazardLevel.rectifyTimeout(hazardLevel));
                workOrder.setResponseDeadline(addMinutes(now, HazardLevel.responseMinutes(hazardLevel)));
                workOrder.setRectifyDeadline(addMinutes(now, HazardLevel.rectifyMinutes(hazardLevel)));
                workOrder.setStatus("pending");
                workOrder.setSuggestion(workSuggestion);
                workOrder.setCreateTime(now);
                workOrder.setUpdateTime(now);
                workOrder.setRecordId(videoRecords.getId());
                workOrderMapper.insert(workOrder);

                // 根据四级隐患等级确定推送角色
                List<String> pushRoles = HazardLevel.pushRoles(hazardLevel);

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

    private String addMinutes(String baseTime, int minutes) {
        Date base;
        try {
            base = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(baseTime);
        } catch (Exception e) {
            base = new Date();
        }
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(base);
        calendar.add(Calendar.MINUTE, minutes);
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(calendar.getTime());
    }
}
