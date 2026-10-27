package com.example.Kcsj.controller;

import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.ImgRecords;
import com.example.Kcsj.mapper.ImgRecordsMapper;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Collections;

@RestController
@RequestMapping("/imgRecords")
public class ImgRecordsController {
    @Resource
    ImgRecordsMapper imgRecordsMapper;

    @GetMapping
    public Result<?> findPage(
            @RequestParam(name="pageNum", defaultValue = "1") Integer pageNum,
            @RequestParam(name="pageSize", defaultValue = "10") Integer pageSize,
            @RequestParam(name="startTime", defaultValue = "") String startTime,
            @RequestParam(name="lable", defaultValue = "") String lable) {
        try {
            List<ImgRecords> records = imgRecordsMapper.selectList(null);
            if (!startTime.isEmpty()) {
                records = records.stream().filter(r -> r.getStartTime().contains(startTime)).collect(Collectors.toList());
            }
            if (!lable.isEmpty()) {
                records = records.stream().filter(r -> r.getLabel().contains(lable)).collect(Collectors.toList());
            }
            int total = records.size();
            int start = (pageNum - 1) * pageSize;
            int end = Math.min(start + pageSize, total);
            List<ImgRecords> pageRecords = start < total ? records.subList(start, end) : Collections.emptyList();
            return Result.success(new java.util.HashMap<String, Object>() {{
                put("records", pageRecords);
                put("total", total);
            }});
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @GetMapping("/all")
    public Result<?> findAll() {
        try {
            List<ImgRecords> records = imgRecordsMapper.selectList(null);
            return Result.success(records);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Integer id) {
        try {
            imgRecordsMapper.deleteById(id);
            return Result.success("删除成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }
}
